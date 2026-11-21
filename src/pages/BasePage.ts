import { Locator, Page } from '@playwright/test';
import { SelfHealingEngine } from '../fixtures/selfHealing';

/**
 * Base Page Object wrapping Playwright interactions with ML-powered Self-Healing.
 */
export abstract class BasePage {
  protected readonly page: Page;
  protected readonly healer: SelfHealingEngine;
  protected abstract readonly pageName: string;

  constructor(page: Page, healer: SelfHealingEngine) {
    this.page = page;
    this.healer = healer;
  }

  protected async locator(
    logicalName: string,
    primarySelector: string,
    options?: { optional?: boolean; timeoutMs?: number }
  ): Promise<Locator> {
    return this.healer.resolve(this.pageName, logicalName, primarySelector, options);
  }

  protected async locatorAll(logicalName: string, primarySelector: string): Promise<Locator> {
    return this.healer.resolveAll(this.pageName, logicalName, primarySelector);
  }

  protected async click(logicalName: string, primarySelector: string): Promise<void> {
    const loc = await this.locator(logicalName, primarySelector);
    await loc.click();
  }

  protected async fill(logicalName: string, primarySelector: string, value: string): Promise<void> {
    const loc = await this.locator(logicalName, primarySelector);
    await loc.fill(value);
  }

  protected async selectOption(logicalName: string, primarySelector: string, value: string): Promise<void> {
    const loc = await this.locator(logicalName, primarySelector);
    await loc.selectOption(value);
  }

  protected async getText(
    logicalName: string,
    primarySelector: string,
    options?: { optional?: boolean }
  ): Promise<string> {
    const loc = await this.locator(logicalName, primarySelector, options);
    const txt = await loc.textContent();
    return (txt || '').trim();
  }

  protected async isVisible(
    logicalName: string,
    primarySelector: string,
    options?: { optional?: boolean; timeoutMs?: number }
  ): Promise<boolean> {
    const loc = await this.locator(logicalName, primarySelector, { optional: true, ...options });
    return loc.isVisible();
  }

  public async waitForView(viewKey: string): Promise<void> {
    await this.page.locator(`[data-page="${viewKey}"]`).waitFor({ state: 'visible', timeout: 10_000 });
  }
}
