import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

export const PROJECT_ROOT = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

export const PATHS = {
  scenariosDir: path.join(PROJECT_ROOT, 'scenarios'),
  reportsDir: path.join(PROJECT_ROOT, 'reports'),
  generatedTestsDir: path.join(PROJECT_ROOT, 'tests', 'generated'),
  manualTestsDir: path.join(PROJECT_ROOT, 'tests', 'manual'),
  testcasesJson: path.join(PROJECT_ROOT, 'reports', 'testcases.json'),
  generationValidationJson: path.join(PROJECT_ROOT, 'reports', 'generation-validation.json'),
  coverageJson: path.join(PROJECT_ROOT, 'reports', 'coverage.json'),
  domSnapshotsJson: path.join(PROJECT_ROOT, 'reports', 'dom-snapshots.json'),
  healingJson: path.join(PROJECT_ROOT, 'reports', 'healing.json'),
  resultsJson: path.join(PROJECT_ROOT, 'reports', 'results.json'),
  rcaJson: path.join(PROJECT_ROOT, 'reports', 'rca.json'),
  predictionsJson: path.join(PROJECT_ROOT, 'reports', 'predictions.json'),
  metricsJson: path.join(PROJECT_ROOT, 'reports', 'metrics.json'),
  historyJson: path.join(PROJECT_ROOT, 'reports', 'history.json'),
  dashboardHtml: path.join(PROJECT_ROOT, 'reports', 'dashboard.html'),
};

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function readJsonSafe<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export const CONFIG = {
  sutUrl: process.env.SUT_URL || 'http://127.0.0.1:3100',
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://127.0.0.1:8100',
  locatorChange: process.env.LOCATOR_CHANGE === 'true',
  bugInjection: process.env.BUG_INJECTION === 'true',
  healingEnabled: process.env.HEALING_ENABLED !== 'false',
  healingThreshold: Number(process.env.HEALING_THRESHOLD || 0.42),
  runMode: process.env.RUN_MODE || (process.env.LOCATOR_CHANGE === 'true' ? 'locator-change+bugs' : 'normal'),
  llmProvider: (process.env.LLM_PROVIDER || 'mock').toLowerCase(),
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
};
