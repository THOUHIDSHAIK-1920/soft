import path from 'path';
import { CONFIG, PATHS, readJsonSafe, writeJson } from '../config';
import {
  AppModule,
  BugPredictionReport,
  CoverageReport,
  GenerationValidationReport,
  HealingEvent,
  MetricsSummary,
  RcaEntry,
  RunHistoryEntry,
  TestRunReport,
} from '../types';

const ALL_MODULES: AppModule[] = [
  'Login',
  'MovieList',
  'MovieDetails',
  'Showtime',
  'SeatMap',
  'Payment',
  'Confirmation',
];

const TOTAL_INJECTED_BUGS = 8;

function buildModuleStats(
  run: TestRunReport,
  healingEvents: HealingEvent[]
): RunHistoryEntry['moduleStats'] {
  return ALL_MODULES.map((mod) => {
    const modTests = run.tests.filter((t) => t.module === mod);
    const failures = modTests.filter((t) => t.status !== 'passed' && t.status !== 'skipped').length;
    const flakyCount = modTests.filter((t) => t.flaky || t.retries > 0).length;
    const flakiness = modTests.length > 0 ? Number((flakyCount / modTests.length).toFixed(4)) : 0;
    const healCount = healingEvents.filter((h) => h.pageName === mod).length;

    return {
      module: mod,
      failure_count: failures,
      healing_count: healCount,
      flakiness,
      has_bug: failures > 0 ? 1 : 0,
    };
  });
}

export async function runMetricsAndPredictions(): Promise<{
  metrics: MetricsSummary;
  predictions: BugPredictionReport;
}> {
  const latestRun = readJsonSafe<TestRunReport | null>(PATHS.resultsJson, null);
  const normalRun = readJsonSafe<TestRunReport | null>(
    path.join(PATHS.reportsDir, 'results-normal.json'),
    null
  );
  const bugRun = readJsonSafe<TestRunReport | null>(
    path.join(PATHS.reportsDir, 'results-locator-bug.json'),
    null
  );

  const genVal = readJsonSafe<GenerationValidationReport | null>(PATHS.generationValidationJson, null);
  const coverage = readJsonSafe<CoverageReport | null>(PATHS.coverageJson, null);
  const healingEvents = readJsonSafe<HealingEvent[]>(PATHS.healingJson, []);
  const rcaData = readJsonSafe<{ entries: RcaEntry[] }>(PATHS.rcaJson, { entries: [] });
  const history = readJsonSafe<RunHistoryEntry[]>(PATHS.historyJson, []);

  // Update history with latest run if not already recorded
  if (latestRun && !history.some((h) => h.runId === latestRun.runId)) {
    const detectedBugSet = new Set<string>();
    for (const t of latestRun.tests) {
      if (t.status !== 'passed' && t.detectedBugId) detectedBugSet.add(t.detectedBugId);
    }
    for (const r of rcaData.entries || []) {
      if (r.linkedBugId) detectedBugSet.add(r.linkedBugId);
    }

    const attempts = healingEvents.length;
    const successes = healingEvents.filter((h) => h.success).length;

    history.push({
      runId: latestRun.runId,
      timestamp: latestRun.timestamp,
      mode: latestRun.mode,
      locatorChange: latestRun.locatorChange,
      bugInjection: latestRun.bugInjection,
      totalTests: latestRun.summary.total,
      passed: latestRun.summary.passed,
      failed: latestRun.summary.failed,
      durationMs: latestRun.totalDurationMs,
      healingAttempts: attempts,
      healingSuccesses: successes,
      healingSuccessRate: attempts > 0 ? Number((successes / attempts).toFixed(4)) : 1,
      detectedBugs: Array.from(detectedBugSet).sort(),
      moduleStats: buildModuleStats(latestRun, healingEvents),
    });
    writeJson(PATHS.historyJson, history);
  }

  // Prepare training history & current module feature vectors for FastAPI RandomForest /predict
  const flatTrainingHistory = history.flatMap((h) => h.moduleStats);
  const targetRunForFeatures = bugRun || latestRun;
  const currentRecords = targetRunForFeatures
    ? buildModuleStats(targetRunForFeatures, healingEvents)
    : ALL_MODULES.map((m) => ({ module: m, failure_count: 0, healing_count: 0, flakiness: 0, has_bug: 0 }));

  let predictionsReport: BugPredictionReport = {
    timestamp: new Date().toISOString(),
    modelAccuracy: 0,
    trainingSamples: 0,
    predictions: [],
  };

  try {
    const res = await fetch(`${CONFIG.aiServiceUrl}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        records: currentRecords,
        history: flatTrainingHistory,
      }),
    });
    if (!res.ok) {
      throw new Error(`/predict returned ${res.status}`);
    }
    const data = (await res.json()) as {
      modelAccuracy: number;
      trainingSamples: number;
      predictions: BugPredictionReport['predictions'];
    };
    predictionsReport = {
      timestamp: new Date().toISOString(),
      modelAccuracy: data.modelAccuracy,
      trainingSamples: data.trainingSamples,
      predictions: data.predictions,
    };
  } catch (err) {
    console.warn('[Module 3] Could not reach AI service /predict:', err);
  }

  writeJson(PATHS.predictionsJson, predictionsReport);

  // Compute Defect Detection Rate across bug-injection run + RCA
  const foundBugs = new Set<string>();
  const defectSource = bugRun || latestRun;
  if (defectSource && defectSource.bugInjection) {
    for (const t of defectSource.tests) {
      if (t.status !== 'passed' && t.detectedBugId) {
        foundBugs.add(t.detectedBugId);
      }
    }
  }
  for (const r of rcaData.entries || []) {
    if (r.linkedBugId) foundBugs.add(r.linkedBugId);
  }
  const detectedBugIds = Array.from(foundBugs).sort();
  const defectsFound = detectedBugIds.length;
  const defectDetectionRate = Number((defectsFound / TOTAL_INJECTED_BUGS).toFixed(4));

  // Booking Workflow Validation Pass Rate (from normal clean run)
  const cleanRun = normalRun || latestRun;
  const bookingWorkflowPassRate =
    cleanRun && cleanRun.summary.total > 0
      ? Number((cleanRun.summary.passed / cleanRun.summary.total).toFixed(4))
      : 0;

  // Locator Healing Success Rate (from healing.json or latest locator-change history)
  let healingAttempts = healingEvents.length;
  let healingSuccesses = healingEvents.filter((h) => h.success).length;
  if (healingAttempts === 0) {
    const lastHealRun = [...history].reverse().find((h) => h.healingAttempts > 0);
    if (lastHealRun) {
      healingAttempts = lastHealRun.healingAttempts;
      healingSuccesses = lastHealRun.healingSuccesses;
    }
  }
  const locatorHealingSuccessRate =
    healingAttempts > 0 ? Number((healingSuccesses / healingAttempts).toFixed(4)) : 0;

  // Execution Time vs Manual QA Baseline (standard manual tester benchmark: 45s per E2E/functional test case)
  const automatedMs = cleanRun ? cleanRun.totalDurationMs : 0;
  const totalCases = cleanRun ? cleanRun.summary.total : 19;
  const manualBaselineMs = totalCases * 45_000;
  const speedupFactor = automatedMs > 0 ? Number((manualBaselineMs / automatedMs).toFixed(2)) : 0;

  const metrics: MetricsSummary = {
    timestamp: new Date().toISOString(),
    testGenerationAccuracy: genVal?.testGenerationAccuracy ?? 0,
    defectDetectionRate,
    defectsFound,
    defectsInjected: TOTAL_INJECTED_BUGS,
    detectedBugIds,
    automationCoverage: coverage?.automationCoverage ?? 0,
    executionTimeAutomatedMs: automatedMs,
    executionTimeManualBaselineMs: manualBaselineMs,
    speedupFactor,
    bugPredictionAccuracy: predictionsReport.modelAccuracy,
    bookingWorkflowPassRate,
    locatorHealingSuccessRate,
    healingAttempts,
    healingSuccesses,
  };

  writeJson(PATHS.metricsJson, metrics);
  console.log('[Module 3] Computed metrics & bug predictions -> reports/metrics.json & reports/predictions.json');
  return { metrics, predictions: predictionsReport };
}

if (require.main === module) {
  runMetricsAndPredictions().catch((err) => {
    console.error('[Module 3] Metrics computation failed:', err);
    process.exit(1);
  });
}
