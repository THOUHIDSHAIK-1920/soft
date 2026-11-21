import { Locator, Page } from '@playwright/test';
import { SelfHealingEngine } from '../fixtures/selfHealing';
import { BasePage } from './BasePage';

export class ConfirmationPage extends BasePage {
  protected readonly pageName = 'Confirmation';

  // Centralized locators
  public static readonly LOCATORS = {
    confirmationBanner: '#confirmation-banner',
    bookingReference: '#booking-reference',
    confirmationTotal: '#confirmation-total',
    bookAnotherBtn: '#book-another-btn',
  };

  constructor(page: Page, healer: SelfHealingEngine) {
    super(page, healer);
  }

  public async getConfirmationBanner(): Promise<Locator> {
    await this.waitForView('confirmation');
    return this.locator('confirmationBanner', ConfirmationPage.LOCATORS.confirmationBanner, { optional: true });
  }

  public async getBookingReferenceLocator(): Promise<Locator> {
    await this.waitForView('confirmation');
    return this.locator('bookingReference', ConfirmationPage.LOCATORS.bookingReference, { optional: true });
  }

  public async getConfirmationTotalText(): Promise<string> {
    await this.waitForView('confirmation');
    return this.getText('confirmationTotal', ConfirmationPage.LOCATORS.confirmationTotal);
  }

  public async clickBookAnother(): Promise<void> {
    await this.waitForView('confirmation');
    await this.click('bookAnotherBtn', ConfirmationPage.LOCATORS.bookAnotherBtn);
    await this.waitForView('movies');
  }
}
