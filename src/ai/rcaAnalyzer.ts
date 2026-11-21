import { PATHS, readJsonSafe, writeJson } from '../config';
import { RcaEntry, TestRunReport } from '../types';
import { PluggableLlmClient } from './llmClient';

export async function runRcaAnalyzer(): Promise<RcaEntry[]> {
  const client = new PluggableLlmClient();
  const report = readJsonSafe<TestRunReport | null>(PATHS.resultsJson, null);

  if (!report) {
    console.warn('[Module 3] No reports/results.json found. Skipping RCA.');
    writeJson(PATHS.rcaJson, { generatedAt: new Date().toISOString(), llmProvider: client.activeProvider, entries: [] });
    return [];
  }

  const failures = report.tests.filter((t) => t.status !== 'passed' && t.status !== 'skipped');
  const entries: RcaEntry[] = [];

  for (const test of failures) {
    const analysis = await client.analyzeFailureRca({
      testTitle: test.title,
      module: test.module,
      error: test.error || 'Unknown assertion failure',
      stack: test.stack || '',
      consoleLogs: test.consoleLogs.map((c) => `[${c.type}] ${c.text}`),
      networkLogs: test.networkLogs.map((n) => `${n.method} ${n.url} -> ${n.status}`),
      domDiff: test.domDiff || '',
    });

    entries.push({
      testId: test.id,
      testTitle: test.title,
      module: test.module,
      category: analysis.category,
      rootCause: analysis.rootCause,
      suggestedFix: analysis.suggestedFix,
      confidence: analysis.confidence,
      linkedBugId: analysis.linkedBugId || test.detectedBugId,
      errorExcerpt: (test.error || '').split('\n')[0].slice(0, 180),
    });
  }

  writeJson(PATHS.rcaJson, {
    generatedAt: new Date().toISOString(),
    runId: report.runId,
    mode: report.mode,
    llmProvider: client.activeProvider,
    totalFailuresAnalyzed: entries.length,
    entries,
  });

  console.log(`[Module 3] RCA Analyzer processed ${entries.length} failures -> reports/rca.json`);
  return entries;
}

if (require.main === module) {
  runRcaAnalyzer().catch((err) => {
    console.error('[Module 3] RCA failed:', err);
    process.exit(1);
  });
}
