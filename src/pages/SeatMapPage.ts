import { Locator, Page } from '@playwright/test';
import { SelfHealingEngine } from '../fixtures/selfHealing';
import { BasePage } from './BasePage';

export class SeatMapPage extends BasePage {
  protected readonly pageName = 'SeatMap';

  // Centralized locators
  public static readonly LOCATORS = {
    seatGrid: '#seat-grid',
    seatButton: (seatLabel: string) => `#seat-${seatLabel}`,
    allSeats: '.seat-btn',
    seatError: '#seat-error',
    availableCount: '#count-available',
    selectedCount: '#count-selected',
    bookedCount: '#count-booked',
    totalPrice: '#seat-total-price',
    proceedToPaymentBtn: '#proceed-to-payment-btn',
  };

  constructor(page: Page, healer: SelfHealingEngine) {
    super(page, healer);
  }

  public async getSeatGrid(): Promise<Locator> {
    await this.waitForView('seats');
    return this.locator('seatGrid', SeatMapPage.LOCATORS.seatGrid);
  }

  public async getSeatLocator(seatLabel: string): Promise<Locator> {
    await this.waitForView('seats');
    return this.locator(`seat_${seatLabel}`, SeatMapPage.LOCATORS.seatButton(seatLabel));
  }

  public async selectSeat(seatLabel: string): Promise<void> {
    await this.waitForView('seats');
    await this.click(`seat_${seatLabel}`, SeatMapPage.LOCATORS.seatButton(seatLabel));
  }

  public async selectSeats(labels: string[]): Promise<void> {
    for (const label of labels) {
      await this.selectSeat(label);
    }
  }

  public async getSeatCounts(): Promise<{ available: number; selected: number; booked: number; totalSeats: number }> {
    await this.waitForView('seats');
    const available = Number(await this.getText('availableCount', SeatMapPage.LOCATORS.availableCount));
    const selected = Number(await this.getText('selectedCount', SeatMapPage.LOCATORS.selectedCount));
    const booked = Number(await this.getText('bookedCount', SeatMapPage.LOCATORS.bookedCount));
    const allSeats = await this.locatorAll('allSeats', SeatMapPage.LOCATORS.allSeats);
    const totalSeats = await allSeats.count();
    return { available, selected, booked, totalSeats };
  }

  public async getDomStatusCounts(): Promise<{ available: number; selected: number; booked: number }> {
    const allSeats = await this.locatorAll('allSeats', SeatMapPage.LOCATORS.allSeats);
    const statuses = await allSeats.evaluateAll((els) => els.map((e) => e.getAttribute('data-status')));
    return {
      available: statuses.filter((s) => s === 'available').length,
      selected: statuses.filter((s) => s === 'selected').length,
      booked: statuses.filter((s) => s === 'booked').length,
    };
  }

  public async getTotalPriceText(): Promise<string> {
    await this.waitForView('seats');
    return this.getText('totalPrice', SeatMapPage.LOCATORS.totalPrice);
  }

  public async getSeatErrorLocator(): Promise<Locator> {
    return this.locator('seatError', SeatMapPage.LOCATORS.seatError, { optional: true });
  }

  public async getProceedButton(): Promise<Locator> {
    await this.waitForView('seats');
    return this.locator('proceedToPaymentBtn', SeatMapPage.LOCATORS.proceedToPaymentBtn);
  }

  public async proceedToPayment(): Promise<void> {
    await this.waitForView('seats');
    await this.click('proceedToPaymentBtn', SeatMapPage.LOCATORS.proceedToPaymentBtn);
    await this.waitForView('payment');
  }
}
