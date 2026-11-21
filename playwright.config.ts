import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const SUT_URL = process.env.SUT_URL || 'http://127.0.0.1:3100';
const WORKERS = process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 4;
const RETRIES = process.env.PW_RETRIES ? Number(process.env.PW_RETRIES) : 1;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: RETRIES,
  workers: WORKERS,
  timeout: 45_000,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.03,
      animations: 'disabled',
    },
  },
  reporter: [
    ['list'],
    ['./src/reporters/customReporter.ts'],
  ],
  use: {
    baseURL: SUT_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    viewport: { width: 1280, height: 800 },
    actionTimeout: 10_000,
  },
  outputDir: 'test-results',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
