import { Locator, Page } from '@playwright/test';
import { SelfHealingEngine } from '../fixtures/selfHealing';
import { BasePage } from './BasePage';

export class ShowtimePage extends BasePage {
  protected readonly pageName = 'Showtime';

  // Centralized locators
  public static readonly LOCATORS = {
    showtimeList: '#showtime-list',
    showtimeButton: (showtimeId: string) => `#select-showtime-${showtimeId}`,
    backToMoviesBtn: '#back-to-movies-btn',
  };

  constructor(page: Page, healer: SelfHealingEngine) {
    super(page, healer);
  }

  public async getShowtimeButton(showtimeId: string): Promise<Locator> {
    await this.waitForView('showtimes');
    return this.locator(`showtimeBtn_${showtimeId}`, ShowtimePage.LOCATORS.showtimeButton(showtimeId));
  }

  public async selectShowtime(showtimeId: string): Promise<void> {
    await this.waitForView('showtimes');
    await this.click(`showtimeBtn_${showtimeId}`, ShowtimePage.LOCATORS.showtimeButton(showtimeId));
    await this.waitForView('seats');
  }

  public async isShowtimeDisabled(showtimeId: string): Promise<boolean> {
    const btn = await this.getShowtimeButton(showtimeId);
    return btn.isDisabled();
  }
}
