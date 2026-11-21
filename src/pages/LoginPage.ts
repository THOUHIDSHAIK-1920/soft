import { Locator, Page } from '@playwright/test';
import { CONFIG } from '../config';
import { SelfHealingEngine } from '../fixtures/selfHealing';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  protected readonly pageName = 'Login';

  // Centralized locators
  public static readonly LOCATORS = {
    emailInput: '#login-email',
    passwordInput: '#login-password',
    submitButton: '#login-submit',
    errorBanner: '#login-error',
  };

  constructor(page: Page, healer: SelfHealingEngine) {
    super(page, healer);
  }

  public async goto(): Promise<void> {
    const qs = new URLSearchParams();
    if (CONFIG.locatorChange) qs.set('locatorChange', 'true');
    if (CONFIG.bugInjection) qs.set('bugs', 'true');
    const suffix = qs.toString() ? `/?${qs.toString()}` : '/';
    await this.page.goto(suffix, { waitUntil: 'domcontentloaded' });
    await this.waitForView('login');
  }

  public async login(email: string, password: string): Promise<void> {
    await this.fill('emailInput', LoginPage.LOCATORS.emailInput, email);
    await this.fill('passwordInput', LoginPage.LOCATORS.passwordInput, password);
    await this.click('submitButton', LoginPage.LOCATORS.submitButton);
  }

  public async loginAsDefaultUser(): Promise<void> {
    await this.goto();
    await this.login('alice@cinebook.com', 'Cinema@123');
    await this.waitForView('movies');
  }

  public async getErrorBanner(): Promise<Locator> {
    return this.locator('errorBanner', LoginPage.LOCATORS.errorBanner, { optional: true });
  }
}
