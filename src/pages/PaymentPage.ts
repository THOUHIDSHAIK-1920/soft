import { Locator, Page } from '@playwright/test';
import { SelfHealingEngine } from '../fixtures/selfHealing';
import { BasePage } from './BasePage';

export interface PaymentDetails {
  cardHolder: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
}

export class PaymentPage extends BasePage {
  protected readonly pageName = 'Payment';

  // Centralized locators
  public static readonly LOCATORS = {
    cardHolderInput: '#card-holder-input',
    cardNumberInput: '#card-number-input',
    cardExpiryInput: '#card-expiry-input',
    cardCvvInput: '#card-cvv-input',
    paymentError: '#payment-error',
    paymentTotal: '#payment-total-amount',
    payNowBtn: '#pay-now-btn',
  };

  constructor(page: Page, healer: SelfHealingEngine) {
    super(page, healer);
  }

  public async fillPaymentDetails(details: PaymentDetails): Promise<void> {
    await this.waitForView('payment');
    await this.fill('cardHolderInput', PaymentPage.LOCATORS.cardHolderInput, details.cardHolder);
    await this.fill('cardNumberInput', PaymentPage.LOCATORS.cardNumberInput, details.cardNumber);
    await this.fill('cardExpiryInput', PaymentPage.LOCATORS.cardExpiryInput, details.expiry);
    await this.fill('cardCvvInput', PaymentPage.LOCATORS.cardCvvInput, details.cvv);
  }

  public async submitPayment(): Promise<void> {
    await this.click('payNowBtn', PaymentPage.LOCATORS.payNowBtn);
  }

  public async payWithValidCard(cardHolder = 'Alice Johnson'): Promise<void> {
    await this.fillPaymentDetails({
      cardHolder,
      cardNumber: '4111111111111111',
      expiry: '12/28',
      cvv: '123',
    });
    await this.submitPayment();
    await this.waitForView('confirmation');
  }

  public async getPaymentTotalText(): Promise<string> {
    await this.waitForView('payment');
    return this.getText('paymentTotal', PaymentPage.LOCATORS.paymentTotal);
  }

  public async getPaymentErrorLocator(): Promise<Locator> {
    return this.locator('paymentError', PaymentPage.LOCATORS.paymentError, { optional: true });
  }
}
