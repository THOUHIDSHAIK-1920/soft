export type TestCaseType = 'positive' | 'negative' | 'boundary';
export type Priority = 'P0' | 'P1' | 'P2';
export type AppModule =
  | 'Login'
  | 'MovieList'
  | 'MovieDetails'
  | 'Showtime'
  | 'SeatMap'
  | 'Payment'
  | 'Confirmation';

export interface StructuredTestCase {
  id: string;
  scenarioFile: string;
  title: string;
  module: AppModule;
  tags: string[];
  steps: string[];
  testData: Record<string, string | number | string[]>;
  expectedResult: string;
  priority: Priority;
  type: TestCaseType;
  templateAction:
    | 'login_valid'
    | 'login_invalid'
    | 'movie_search'
    | 'movie_genre_filter'
    | 'movie_details'
    | 'showtime_soldout_check'
    | 'seat_selection_price'
    | 'seat_booked_blocked'
    | 'seat_limit_exceeded'
    | 'seat_limit_boundary_6'
    | 'payment_invalid_card'
    | 'booking_e2e_confirmation';
}

export interface ElementSnapshot {
  tag: string;
  id: string;
  classes: string[];
  text: string;
  attributes: Record<string, string>;
  parentPath: string;
  siblings: string[];
  selector?: string;
}

export interface HealingEvent {
  timestamp: string;
  testTitle: string;
  pageName: string;
  logicalName: string;
  oldLocator: string;
  newLocator: string | null;
  score: number;
  success: boolean;
  method?: string;
  clusterId?: number;
}

export interface ConsoleLogEntry {
  type: string;
  text: string;
  timestamp: string;
}

export interface NetworkLogEntry {
  method: string;
  url: string;
  status: number;
  timestamp: string;
}

export interface TestResultRecord {
  id: string;
  title: string;
  file: string;
  suiteType: 'manual' | 'generated';
  module: AppModule;
  tags: string[];
  status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
  durationMs: number;
  retries: number;
  flaky: boolean;
  error?: string;
  stack?: string;
  screenshotPath?: string;
  tracePath?: string;
  consoleLogs: ConsoleLogEntry[];
  networkLogs: NetworkLogEntry[];
  domDiff?: string;
  healingEvents: HealingEvent[];
  detectedBugId?: string;
}

export interface TestRunReport {
  runId: string;
  timestamp: string;
  mode: string;
  locatorChange: boolean;
  bugInjection: boolean;
  totalDurationMs: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    flaky: number;
  };
  tests: TestResultRecord[];
}

export type RcaCategory =
  | 'locator change'
  | 'app bug'
  | 'data issue'
  | 'timing'
  | 'environment';

export interface RcaEntry {
  testId: string;
  testTitle: string;
  module: AppModule;
  category: RcaCategory;
  rootCause: string;
  suggestedFix: string;
  confidence: number;
  linkedBugId?: string;
  errorExcerpt: string;
}

export interface ModulePrediction {
  module: AppModule;
  bugProbability: number;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  predictedBugProne: boolean;
  features: {
    failure_count: number;
    healing_count: number;
    flakiness: number;
  };
}

export interface BugPredictionReport {
  timestamp: string;
  modelAccuracy: number;
  trainingSamples: number;
  predictions: ModulePrediction[];
}

export interface GenerationValidationReport {
  timestamp: string;
  totalGenerated: number;
  validGenerated: number;
  testGenerationAccuracy: number;
  specs: Array<{
    file: string;
    testCaseIds: string[];
    tscValid: boolean;
    dryRunValid: boolean;
    error?: string;
  }>;
}

export interface CoverageReport {
  timestamp: string;
  totalFeatures: number;
  coveredFeatures: number;
  automationCoverage: number;
  pages: Array<{
    page: AppModule;
    features: Array<{
      name: string;
      covered: boolean;
      tests: string[];
    }>;
  }>;
}

export interface RunHistoryEntry {
  runId: string;
  timestamp: string;
  mode: string;
  locatorChange: boolean;
  bugInjection: boolean;
  totalTests: number;
  passed: number;
  failed: number;
  durationMs: number;
  healingAttempts: number;
  healingSuccesses: number;
  healingSuccessRate: number;
  detectedBugs: string[];
  moduleStats: Array<{
    module: AppModule;
    failure_count: number;
    healing_count: number;
    flakiness: number;
    has_bug: number;
  }>;
}

export interface MetricsSummary {
  timestamp: string;
  testGenerationAccuracy: number;
  defectDetectionRate: number;
  defectsFound: number;
  defectsInjected: number;
  detectedBugIds: string[];
  automationCoverage: number;
  executionTimeAutomatedMs: number;
  executionTimeManualBaselineMs: number;
  speedupFactor: number;
  bugPredictionAccuracy: number;
  bookingWorkflowPassRate: number;
  locatorHealingSuccessRate: number;
  healingAttempts: number;
  healingSuccesses: number;
}
