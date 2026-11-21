import { test as base, expect } from '@playwright/test';
import { ConsoleLogEntry, NetworkLogEntry } from '../types';
import { ConfirmationPage } from '../pages/ConfirmationPage';
import { LoginPage } from '../pages/LoginPage';
import { MovieDetailsPage } from '../pages/MovieDetailsPage';
import { MovieListPage } from '../pages/MovieListPage';
import { PaymentPage } from '../pages/PaymentPage';
import { SeatMapPage } from '../pages/SeatMapPage';
import { ShowtimePage } from '../pages/ShowtimePage';
import { SelfHealingEngine } from './selfHealing';

export interface CineBookFixtures {
  healer: SelfHealingEngine;
  loginPage: LoginPage;
  movieListPage: MovieListPage;
  movieDetailsPage: MovieDetailsPage;
  showtimePage: ShowtimePage;
  seatMapPage: SeatMapPage;
  paymentPage: PaymentPage;
  confirmationPage: ConfirmationPage;
}

export const test = base.extend<CineBookFixtures>({
  healer: async ({ page }, use, testInfo) => {
    const consoleLogs: ConsoleLogEntry[] = [];
    const networkLogs: NetworkLogEntry[] = [];

    page.on('console', (msg) => {
      consoleLogs.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString(),
      });
    });

    page.on('pageerror', (err) => {
      consoleLogs.push({
        type: 'pageerror',
        text: err.message,
        timestamp: new Date().toISOString(),
      });
    });

    page.on('response', (res) => {
      const url = res.url();
      if (url.includes('/api/')) {
        networkLogs.push({
          method: res.request().method(),
          url: url.replace(/^https?:\/\/[^/]+/, ''),
          status: res.status(),
          timestamp: new Date().toISOString(),
        });
      }
    });

    const engine = new SelfHealingEngine(page, testInfo.title);
    await use(engine);

    // Capture lightweight DOM snapshot / diff summary on failure for Root-Cause Analysis
    let domDiff = '';
    if (testInfo.status !== testInfo.expectedStatus) {
      try {
        domDiff = await page.evaluate(() => {
          const activePage = document.querySelector('[data-page]')?.getAttribute('data-page') || 'unknown';
          const alerts = Array.from(document.querySelectorAll('[role="alert"], [role="status"]')).map((e) => ({
            id: e.id,
            role: e.getAttribute('role'),
            text: (e.textContent || '').trim(),
          }));
          const ids = Array.from(document.querySelectorAll('[id]'))
            .map((e) => `${e.tagName.toLowerCase()}#${e.id}`)
            .slice(0, 25);
          const heading = document.querySelector('h1')?.textContent?.trim() || '';
          return JSON.stringify({ activePage, heading, alerts, visibleIds: ids });
        });
      } catch {
        domDiff = '{"error":"DOM unavailable at teardown"}';
      }
    }

    await testInfo.attach('ai-diagnostics', {
      contentType: 'application/json',
      body: Buffer.from(
        JSON.stringify({
          consoleLogs: consoleLogs.slice(-30),
          networkLogs: networkLogs.slice(-30),
          domDiff,
          healingEvents: engine.sessionEvents,
        }),
        'utf-8'
      ),
    });
  },

  loginPage: async ({ page, healer }, use) => {
    await use(new LoginPage(page, healer));
  },
  movieListPage: async ({ page, healer }, use) => {
    await use(new MovieListPage(page, healer));
  },
  movieDetailsPage: async ({ page, healer }, use) => {
    await use(new MovieDetailsPage(page, healer));
  },
  showtimePage: async ({ page, healer }, use) => {
    await use(new ShowtimePage(page, healer));
  },
  seatMapPage: async ({ page, healer }, use) => {
    await use(new SeatMapPage(page, healer));
  },
  paymentPage: async ({ page, healer }, use) => {
    await use(new PaymentPage(page, healer));
  },
  confirmationPage: async ({ page, healer }, use) => {
    await use(new ConfirmationPage(page, healer));
  },
});

export { expect };
