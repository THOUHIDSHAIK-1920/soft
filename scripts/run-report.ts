import { runRcaAnalyzer } from '../src/ai/rcaAnalyzer';
import { generateDashboard } from '../src/reporting/dashboardGenerator';
import { runMetricsAndPredictions } from '../src/reporting/metricsEngine';

async function main(): Promise<void> {
  console.log('\n=== Module 3: Running RCA, Bug Prediction, Metrics & Dashboard ===');
  await runRcaAnalyzer();
  const { metrics } = await runMetricsAndPredictions();
  const dashboardPath = generateDashboard();

  console.log('\n--- Framework Metrics Summary ---');
  console.log(`Test Generation Accuracy:      ${(metrics.testGenerationAccuracy * 100).toFixed(1)}%`);
  console.log(`Defect Detection Rate:         ${(metrics.defectDetectionRate * 100).toFixed(1)}% (${metrics.defectsFound}/${metrics.defectsInjected}: ${metrics.detectedBugIds.join(', ') || 'None'})`);
  console.log(`Automation Coverage:           ${(metrics.automationCoverage * 100).toFixed(1)}%`);
  console.log(`Execution Time (Auto vs Man):  ${(metrics.executionTimeAutomatedMs / 1000).toFixed(2)}s vs ${(metrics.executionTimeManualBaselineMs / 1000).toFixed(0)}s (${metrics.speedupFactor}x faster)`);
  console.log(`Bug Prediction Accuracy:       ${(metrics.bugPredictionAccuracy * 100).toFixed(1)}%`);
  console.log(`Booking Workflow Pass Rate:    ${(metrics.bookingWorkflowPassRate * 100).toFixed(1)}%`);
  console.log(`Locator Healing Success Rate:  ${(metrics.locatorHealingSuccessRate * 100).toFixed(1)}% (${metrics.healingSuccesses}/${metrics.healingAttempts})`);
  console.log(`HTML Dashboard:                ${dashboardPath}\n`);
}

main().catch((err) => {
  console.error('[Report] Failed:', err);
  process.exit(1);
});
