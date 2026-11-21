import fs from 'fs';
import path from 'path';
import { PATHS, ensureDir, readJsonSafe } from '../config';
import {
  BugPredictionReport,
  CoverageReport,
  GenerationValidationReport,
  HealingEvent,
  MetricsSummary,
  RcaEntry,
  RunHistoryEntry,
  TestRunReport,
} from '../types';

const ALL_BUG_CATALOG = [
  { id: 'BUG-01', module: 'SeatMap', name: 'Booked seat selectable' },
  { id: 'BUG-02', module: 'SeatMap', name: 'Wrong total price (+$15 fee)' },
  { id: 'BUG-03', module: 'SeatMap', name: 'No max-6 seat limit validation' },
  { id: 'BUG-04', module: 'Confirmation', name: 'Missing confirmation & booking ref' },
  { id: 'BUG-05', module: 'Login', name: 'Empty/invalid login bypass' },
  { id: 'BUG-06', module: 'MovieList', name: 'Broken movie search & filter' },
  { id: 'BUG-07', module: 'Payment', name: 'Invalid credit card accepted' },
  { id: 'BUG-08', module: 'Showtime', name: 'Sold-out showtime selectable' },
];

function esc(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pct(val: number): string {
  return `${(val * 100).toFixed(1)}%`;
}

export function generateDashboard(): string {
  const metrics = readJsonSafe<MetricsSummary | null>(PATHS.metricsJson, null);
  const normalRun = readJsonSafe<TestRunReport | null>(
    path.join(PATHS.reportsDir, 'results-normal.json'),
    null
  );
  const bugRun = readJsonSafe<TestRunReport | null>(
    path.join(PATHS.reportsDir, 'results-locator-bug.json'),
    null
  );
  const latestRun = readJsonSafe<TestRunReport | null>(PATHS.resultsJson, null);
  const coverage = readJsonSafe<CoverageReport | null>(PATHS.coverageJson, null);
  const genVal = readJsonSafe<GenerationValidationReport | null>(PATHS.generationValidationJson, null);
  const healing = readJsonSafe<HealingEvent[]>(PATHS.healingJson, []);
  const rca = readJsonSafe<{ entries: RcaEntry[]; llmProvider?: string }>(PATHS.rcaJson, { entries: [] });
  const predictions = readJsonSafe<BugPredictionReport | null>(PATHS.predictionsJson, null);
  const history = readJsonSafe<RunHistoryEntry[]>(PATHS.historyJson, []);

  const m: MetricsSummary = metrics || {
    timestamp: new Date().toISOString(),
    testGenerationAccuracy: 0,
    defectDetectionRate: 0,
    defectsFound: 0,
    defectsInjected: 8,
    detectedBugIds: [],
    automationCoverage: 0,
    executionTimeAutomatedMs: 0,
    executionTimeManualBaselineMs: 0,
    speedupFactor: 0,
    bugPredictionAccuracy: 0,
    bookingWorkflowPassRate: 0,
    locatorHealingSuccessRate: 0,
    healingAttempts: 0,
    healingSuccesses: 0,
  };

  const pageLabels = (coverage?.pages || []).map((p) => p.page);
  const pageCovPct = (coverage?.pages || []).map((p) => {
    const cov = p.features.filter((f) => f.covered).length;
    return p.features.length ? Math.round((cov / p.features.length) * 100) : 0;
  });

  const predLabels = (predictions?.predictions || []).map((p) => p.module);
  const predProbs = (predictions?.predictions || []).map((p) => Math.round(p.bugProbability * 100));

  const normalSummary = normalRun?.summary || { passed: 0, failed: 0, total: 0 };
  const bugSummary = bugRun?.summary || latestRun?.summary || { passed: 0, failed: 0, total: 0 };

  const defectRows = ALL_BUG_CATALOG.map((b) => {
    const found = m.detectedBugIds.includes(b.id);
    return `
      <tr>
        <td><code>${b.id}</code></td>
        <td>${esc(b.module)}</td>
        <td>${esc(b.name)}</td>
        <td><span class="pill ${found ? 'pill-green' : 'pill-red'}">${found ? 'DETECTED' : 'MISSED'}</span></td>
      </tr>
    `;
  }).join('');

  const rcaRows =
    (rca.entries || []).length > 0
      ? rca.entries
          .map(
            (e) => `
        <tr>
          <td><strong>${esc(e.testTitle)}</strong></td>
          <td>${esc(e.module)}</td>
          <td><span class="pill pill-amber">${esc(e.category)}</span></td>
          <td><code>${esc(e.linkedBugId || 'N/A')}</code></td>
          <td>${esc(e.rootCause)}</td>
          <td>${esc(e.suggestedFix)}</td>
        </tr>`
          )
          .join('')
      : '<tr><td colspan="6" style="text-align:center;color:#94a3b8;">No failures recorded in latest run.</td></tr>';

  const healingRows =
    healing.length > 0
      ? healing
          .slice(0, 40)
          .map(
            (h) => `
        <tr>
          <td>${esc(h.pageName)}</td>
          <td><code>${esc(h.oldLocator)}</code></td>
          <td><code>${esc(h.newLocator || '—')}</code></td>
          <td>${(h.score * 100).toFixed(1)}%</td>
          <td>${esc(h.method || 'tfidf-cosine')}</td>
          <td><span class="pill ${h.success ? 'pill-green' : 'pill-red'}">${h.success ? 'HEALED' : 'FAILED'}</span></td>
        </tr>`
          )
          .join('')
      : '<tr><td colspan="6" style="text-align:center;color:#94a3b8;">No locator healing events triggered yet.</td></tr>';

  const predRows =
    (predictions?.predictions || []).length > 0
      ? predictions!.predictions
          .map(
            (p) => `
        <tr>
          <td><strong>${esc(p.module)}</strong></td>
          <td>${(p.bugProbability * 100).toFixed(1)}%</td>
          <td><span class="pill ${p.riskLevel === 'HIGH' ? 'pill-red' : p.riskLevel === 'MEDIUM' ? 'pill-amber' : 'pill-green'}">${p.riskLevel}</span></td>
          <td>${p.features.failure_count}</td>
          <td>${p.features.healing_count}</td>
          <td>${(p.features.flakiness * 100).toFixed(1)}%</td>
        </tr>`
          )
          .join('')
      : '<tr><td colspan="6" style="text-align:center;color:#94a3b8;">No predictions available.</td></tr>';

  const historyRows = history
    .map(
      (h) => `
      <tr>
        <td><code>${esc(h.runId)}</code></td>
        <td>${esc(h.mode)}</td>
        <td>${h.passed} / ${h.totalTests}</td>
        <td>${h.failed}</td>
        <td>${(h.durationMs / 1000).toFixed(2)}s</td>
        <td>${h.healingSuccesses}/${h.healingAttempts} (${pct(h.healingSuccessRate)})</td>
        <td>${h.detectedBugs.length}/8</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI-Powered Movie Ticket Testing Framework — Intelligence Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.6/dist/chart.umd.min.js"></script>
  <style>
    :root {
      --bg: #0b1120;
      --card: #111c33;
      --border: #1e293b;
      --text: #f1f5f9;
      --muted: #94a3b8;
      --blue: #3b82f6;
      --green: #10b981;
      --amber: #f59e0b;
      --red: #ef4444;
      --purple: #8b5cf6;
      --cyan: #06b6d4;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 24px;
      line-height: 1.5;
    }
    .wrap { max-width: 1360px; margin: 0 auto; }
    header {
      display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center;
      border-bottom: 1px solid var(--border); padding-bottom: 18px; margin-bottom: 24px; gap: 12px;
    }
    h1 { font-size: 1.55rem; font-weight: 800; }
    .sub { color: var(--muted); font-size: 0.9rem; margin-top: 4px; }
    .kpi-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 24px;
    }
    .kpi {
      background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px;
    }
    .kpi-label { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); }
    .kpi-val { font-size: 1.7rem; font-weight: 800; margin: 6px 0 4px; color: #fff; }
    .kpi-note { font-size: 0.78rem; color: #cbd5e1; }
    .charts-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 18px; margin-bottom: 24px;
    }
    .panel {
      background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 20px;
    }
    .panel h2 { font-size: 1.08rem; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; }
    .chart-box { position: relative; height: 260px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: top; }
    th { color: var(--muted); font-weight: 600; font-size: 0.78rem; text-transform: uppercase; }
    code { background: #1e293b; padding: 2px 6px; border-radius: 4px; font-size: 0.82rem; color: #93c5fd; }
    .pill { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 0.74rem; font-weight: 700; }
    .pill-green { background: rgba(16,185,129,0.2); color: #34d399; }
    .pill-red { background: rgba(239,68,68,0.2); color: #f87171; }
    .pill-amber { background: rgba(245,158,11,0.2); color: #fbbf24; }
    .bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; font-size: 0.85rem; }
    .bar-track { flex: 1; height: 10px; background: #1e293b; border-radius: 999px; overflow: hidden; }
    .bar-fill { height: 100%; background: linear-gradient(90deg, var(--blue), var(--cyan)); border-radius: 999px; }
    .two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(460px, 1fr)); gap: 18px; }
  </style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>🎬 AI-Powered Movie Ticket Booking Test Intelligence Dashboard</h1>
      <p class="sub">Hybrid AI (LLM + TF-IDF/Clustering Self-Healing + RandomForest Bug Predictor) &amp; Playwright Automation</p>
    </div>
    <div style="text-align:right;font-size:0.84rem;color:#94a3b8;">
      <div>Generated: <strong>${esc(new Date(m.timestamp).toLocaleString())}</strong></div>
      <div>LLM Provider: <code>${esc(rca.llmProvider || 'mock')}</code></div>
    </div>
  </header>

  <section class="kpi-grid">
    <div class="kpi">
      <div class="kpi-label">Test Gen Accuracy</div>
      <div class="kpi-val" style="color:#34d399">${pct(m.testGenerationAccuracy)}</div>
      <div class="kpi-note">${genVal?.validGenerated || 0}/${genVal?.totalGenerated || 0} tsc + dry-run valid</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Defect Detection Rate</div>
      <div class="kpi-val" style="color:#fbbf24">${pct(m.defectDetectionRate)}</div>
      <div class="kpi-note">${m.defectsFound}/${m.defectsInjected} injected bugs caught</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Automation Coverage</div>
      <div class="kpi-val" style="color:#60a5fa">${pct(m.automationCoverage)}</div>
      <div class="kpi-note">${coverage?.coveredFeatures || 0}/${coverage?.totalFeatures || 0} features covered</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Execution Speedup</div>
      <div class="kpi-val" style="color:#22d3ee">${m.speedupFactor}x</div>
      <div class="kpi-note">${(m.executionTimeAutomatedMs / 1000).toFixed(1)}s vs ${(m.executionTimeManualBaselineMs / 1000).toFixed(0)}s manual</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Bug Prediction Acc.</div>
      <div class="kpi-val" style="color:#a78bfa">${pct(m.bugPredictionAccuracy)}</div>
      <div class="kpi-note">RandomForest (${predictions?.trainingSamples || 0} samples)</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Workflow Pass Rate</div>
      <div class="kpi-val" style="color:#34d399">${pct(m.bookingWorkflowPassRate)}</div>
      <div class="kpi-note">Normal baseline (${normalSummary.passed}/${normalSummary.total})</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">Locator Healing Rate</div>
      <div class="kpi-val" style="color:#38bdf8">${pct(m.locatorHealingSuccessRate)}</div>
      <div class="kpi-note">${m.healingSuccesses}/${m.healingAttempts} broken locators healed</div>
    </div>
  </section>

  <section class="charts-grid">
    <div class="panel">
      <h2>Pass / Fail Comparison (Normal vs Locator-Change + Bugs)</h2>
      <div class="chart-box"><canvas id="passFailChart"></canvas></div>
    </div>
    <div class="panel">
      <h2>Framework Metrics Radar / Benchmark (%)</h2>
      <div class="chart-box"><canvas id="metricsBarChart"></canvas></div>
    </div>
    <div class="panel">
      <h2>Automation Coverage by Page (%)</h2>
      <div class="chart-box"><canvas id="coverageChart"></canvas></div>
    </div>
    <div class="panel">
      <h2>Execution Time: Automated vs Manual Baseline (sec)</h2>
      <div class="chart-box"><canvas id="execTimeChart"></canvas></div>
    </div>
  </section>

  <section class="two-col">
    <div class="panel">
      <h2>Injected Defect Detection Matrix (${m.defectsFound}/8 Found)</h2>
      <table>
        <thead><tr><th>Bug ID</th><th>Module</th><th>Injected Fault</th><th>Status</th></tr></thead>
        <tbody>${defectRows}</tbody>
      </table>
    </div>

    <div class="panel">
      <h2>RandomForest Bug Risk Predictions (Accuracy: ${pct(m.bugPredictionAccuracy)})</h2>
      <div class="chart-box" style="height:210px;margin-bottom:14px;"><canvas id="bugPredChart"></canvas></div>
      <table>
        <thead><tr><th>Module</th><th>Bug Prob.</th><th>Risk</th><th>Failures</th><th>Heals</th><th>Flaky</th></tr></thead>
        <tbody>${predRows}</tbody>
      </table>
    </div>
  </section>

  <section class="panel">
    <h2>AI Root-Cause Analysis (RCA) — ${rca.entries.length} Analyzed Failures</h2>
    <div style="overflow-x:auto;">
      <table>
        <thead><tr><th>Failed Test</th><th>Module</th><th>Category</th><th>Bug ID</th><th>Root Cause</th><th>Suggested Fix</th></tr></thead>
        <tbody>${rcaRows}</tbody>
      </table>
    </div>
  </section>

  <section class="panel">
    <h2>Self-Healing Locator Log (${m.healingSuccesses}/${m.healingAttempts} Succeeded)</h2>
    <div style="overflow-x:auto;">
      <table>
        <thead><tr><th>Page</th><th>Broken Locator</th><th>Healed Locator</th><th>Similarity</th><th>Method</th><th>Outcome</th></tr></thead>
        <tbody>${healingRows}</tbody>
      </table>
    </div>
  </section>

  <section class="panel">
    <h2>Execution Run History</h2>
    <table>
      <thead><tr><th>Run ID</th><th>Mode</th><th>Passed</th><th>Failed</th><th>Duration</th><th>Healing</th><th>Bugs Found</th></tr></thead>
      <tbody>${historyRows}</tbody>
    </table>
  </section>
</div>

<script>
  const chartTextColor = '#cbd5e1';
  const gridColor = 'rgba(148, 163, 184, 0.14)';

  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = chartTextColor;

    new Chart(document.getElementById('passFailChart'), {
      type: 'bar',
      data: {
        labels: ['Normal Mode (Clean SUT)', 'Locator-Change + 8 Bugs'],
        datasets: [
          { label: 'Passed', data: [${normalSummary.passed}, ${bugSummary.passed}], backgroundColor: '#10b981' },
          { label: 'Failed (Defects Caught)', data: [${normalSummary.failed}, ${bugSummary.failed}], backgroundColor: '#ef4444' }
        ]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: gridColor } } } }
    });

    new Chart(document.getElementById('metricsBarChart'), {
      type: 'bar',
      data: {
        labels: ['Test Gen Acc.', 'Defect Detect', 'Coverage', 'Bug Pred Acc.', 'Workflow Pass', 'Healing Rate'],
        datasets: [{
          label: 'Score (%)',
          data: [
            ${(m.testGenerationAccuracy * 100).toFixed(1)},
            ${(m.defectDetectionRate * 100).toFixed(1)},
            ${(m.automationCoverage * 100).toFixed(1)},
            ${(m.bugPredictionAccuracy * 100).toFixed(1)},
            ${(m.bookingWorkflowPassRate * 100).toFixed(1)},
            ${(m.locatorHealingSuccessRate * 100).toFixed(1)}
          ],
          backgroundColor: ['#34d399', '#fbbf24', '#60a5fa', '#a78bfa', '#10b981', '#38bdf8']
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, grid: { color: gridColor } } }, plugins: { legend: { display: false } } }
    });

    new Chart(document.getElementById('coverageChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(pageLabels)},
        datasets: [{ label: 'Feature Coverage %', data: ${JSON.stringify(pageCovPct)}, backgroundColor: '#3b82f6' }]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, grid: { color: gridColor } } }, plugins: { legend: { display: false } } }
    });

    new Chart(document.getElementById('execTimeChart'), {
      type: 'bar',
      data: {
        labels: ['Automated Parallel Suite', 'Manual QA Baseline'],
        datasets: [{
          label: 'Execution Time (seconds)',
          data: [${(m.executionTimeAutomatedMs / 1000).toFixed(2)}, ${(m.executionTimeManualBaselineMs / 1000).toFixed(2)}],
          backgroundColor: ['#06b6d4', '#64748b']
        }]
      },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { beginAtZero: true, grid: { color: gridColor } } }, plugins: { legend: { display: false } } }
    });

    new Chart(document.getElementById('bugPredChart'), {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(predLabels)},
        datasets: [{
          label: 'Predicted Defect Probability (%)',
          data: ${JSON.stringify(predProbs)},
          backgroundColor: ${JSON.stringify(predProbs.map((v) => (v >= 65 ? '#ef4444' : v >= 35 ? '#f59e0b' : '#10b981')))}
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, grid: { color: gridColor } } }, plugins: { legend: { display: false } } }
    });
  }
</script>
</body>
</html>
`;

  ensureDir(PATHS.reportsDir);
  fs.writeFileSync(PATHS.dashboardHtml, html, 'utf-8');
  console.log(`[Module 3] Generated interactive HTML dashboard -> reports/dashboard.html`);
  return PATHS.dashboardHtml;
}

if (require.main === module) {
  generateDashboard();
}
