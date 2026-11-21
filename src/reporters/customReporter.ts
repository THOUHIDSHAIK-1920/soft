import path from 'path';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import { CONFIG, PATHS, PROJECT_ROOT, writeJson } from '../config';
import {
  clearHealingTempLog,
  consolidateHealingEvents,
  mergeWorkerSnapshots,
} from '../fixtures/selfHealing';
import {
  AppModule,
  ConsoleLogEntry,
  HealingEvent,
  NetworkLogEntry,
  TestResultRecord,
  TestRunReport,
} from '../types';

function inferModule(title: string, file: string): AppModule {
  const f = file.toLowerCase();
  if (f.includes('login.')) return 'Login';
  if (f.includes('movielist.')) return 'MovieList';
  if (f.includes('moviedetails.')) return 'MovieDetails';
  if (f.includes('showtime.')) return 'Showtime';
  if (f.includes('seatmap.') || f.includes('seat-map')) return 'SeatMap';
  if (f.includes('payment.')) return 'Payment';
  if (f.includes('confirmation.') || f.includes('booking-e2e.')) return 'Confirmation';

  const t = title.toLowerCase();
  if (t.includes('confirmation') || t.includes('e2e') || t.includes('end-to-end')) return 'Confirmation';
  if (t.includes('payment') || t.includes('card') || t.includes('cvv')) return 'Payment';
  if (t.includes('seat') || t.includes('visual') || t.includes('price') || t.includes('boundary')) return 'SeatMap';
  if (t.includes('showtime') || t.includes('sold-out') || t.includes('sold out')) return 'Showtime';
  if (t.includes('detail')) return 'MovieDetails';
  if (t.includes('search') || t.includes('genre') || t.includes('catalog') || t.includes('movie')) return 'MovieList';
  if (t.includes('login') || t.includes('auth') || t.includes('credential')) return 'Login';
  return 'SeatMap';
}

function inferBugId(title: string, error?: string): string | undefined {
  const text = `${title} ${error || ''}`.toUpperCase();
  const explicit = text.match(/BUG-0[1-8]/);
  if (explicit) return explicit[0];
  const lower = text.toLowerCase();
  if (lower.includes('booked seat')) return 'BUG-01';
  if (lower.includes('total price') || lower.includes('$28.00') || lower.includes('$72.00')) return 'BUG-02';
  if (lower.includes('seat limit') || lower.includes('7th seat') || lower.includes('maximum 6')) return 'BUG-03';
  if (lower.includes('confirmation') || lower.includes('booking reference')) return 'BUG-04';
  if (lower.includes('invalid login') || lower.includes('invalid or empty login')) return 'BUG-05';
  if (lower.includes('search') || lower.includes('genre')) return 'BUG-06';
  if (lower.includes('card') || lower.includes('cvv')) return 'BUG-07';
  if (lower.includes('sold-out') || lower.includes('sold out') || lower.includes('st-103')) return 'BUG-08';
  return undefined;
}

function extractTags(title: string): string[] {
  const matches = title.match(/@[a-zA-Z0-9_-]+/g);
  return matches ? Array.from(new Set(matches)) : [];
}

class CustomAiReporter implements Reporter {
  private startTime = Date.now();
  private recordsByTestId = new Map<string, TestResultRecord>();

  onBegin(_config: FullConfig, _suite: Suite): void {
    this.startTime = Date.now();
    this.recordsByTestId.clear();
    clearHealingTempLog();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const relFile = path.relative(PROJECT_ROOT, test.location.file).replace(/\\/g, '/');
    const suiteType = relFile.includes('tests/generated') ? 'generated' : 'manual';
    const testId = `${relFile}::${test.title}`;

    let consoleLogs: ConsoleLogEntry[] = [];
    let networkLogs: NetworkLogEntry[] = [];
    let domDiff = '';
    let healingEvents: HealingEvent[] = [];
    let screenshotPath: string | undefined;
    let tracePath: string | undefined;

    for (const att of result.attachments) {
      if (att.name === 'ai-diagnostics' && att.body) {
        try {
          const parsed = JSON.parse(att.body.toString('utf-8')) as {
            consoleLogs?: ConsoleLogEntry[];
            networkLogs?: NetworkLogEntry[];
            domDiff?: string;
            healingEvents?: HealingEvent[];
          };
          consoleLogs = parsed.consoleLogs || [];
          networkLogs = parsed.networkLogs || [];
          domDiff = parsed.domDiff || '';
          healingEvents = parsed.healingEvents || [];
        } catch {
          // ignore malformed diagnostics
        }
      } else if (att.name === 'screenshot' && att.path) {
        screenshotPath = path.relative(PROJECT_ROOT, att.path).replace(/\\/g, '/');
      } else if (att.name === 'trace' && att.path) {
        tracePath = path.relative(PROJECT_ROOT, att.path).replace(/\\/g, '/');
      }
    }

    const firstError = result.errors?.[0];
    const errorMsg = firstError?.message?.replace(/\u001b\[[0-9;]*m/g, '') || undefined;
    const stackMsg = firstError?.stack?.replace(/\u001b\[[0-9;]*m/g, '') || undefined;

    const existing = this.recordsByTestId.get(testId);
    const flaky = Boolean(existing && existing.status !== 'passed' && result.status === 'passed');

    const record: TestResultRecord = {
      id: testId,
      title: test.title,
      file: relFile,
      suiteType,
      module: inferModule(test.title, relFile),
      tags: extractTags(test.title),
      status: result.status,
      durationMs: result.duration,
      retries: result.retry,
      flaky,
      error: errorMsg,
      stack: stackMsg,
      screenshotPath,
      tracePath,
      consoleLogs,
      networkLogs,
      domDiff,
      healingEvents: existing ? [...existing.healingEvents, ...healingEvents] : healingEvents,
      detectedBugId: result.status !== 'passed' ? inferBugId(test.title, errorMsg) : undefined,
    };

    this.recordsByTestId.set(testId, record);
  }

  onEnd(_result: FullResult): void {
    const totalDurationMs = Date.now() - this.startTime;
    const tests = Array.from(this.recordsByTestId.values());

    // Merge worker DOM snapshots and consolidate all healing events
    mergeWorkerSnapshots();
    consolidateHealingEvents();

    const passed = tests.filter((t) => t.status === 'passed').length;
    const failed = tests.filter((t) => t.status === 'failed' || t.status === 'timedOut' || t.status === 'interrupted').length;
    const skipped = tests.filter((t) => t.status === 'skipped').length;
    const flaky = tests.filter((t) => t.flaky).length;

    const report: TestRunReport = {
      runId: `run-${Date.now()}`,
      timestamp: new Date().toISOString(),
      mode: CONFIG.runMode,
      locatorChange: CONFIG.locatorChange,
      bugInjection: CONFIG.bugInjection,
      totalDurationMs,
      summary: {
        total: tests.length,
        passed,
        failed,
        skipped,
        flaky,
      },
      tests,
    };

    writeJson(PATHS.resultsJson, report);

    // Also store mode-specific copy so normal vs locator-change+bug runs are preserved for comparison
    const modeFile = CONFIG.locatorChange
      ? path.join(PATHS.reportsDir, 'results-locator-bug.json')
      : path.join(PATHS.reportsDir, 'results-normal.json');
    writeJson(modeFile, report);
  }
}

export default CustomAiReporter;
