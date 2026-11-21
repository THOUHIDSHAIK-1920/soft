import { Page } from '@playwright/test';
import { SelfHealingEngine } from '../fixtures/selfHealing';
import { BasePage } from './BasePage';

export class MovieDetailsPage extends BasePage {
  protected readonly pageName = 'MovieDetails';

  // Centralized locators
  public static readonly LOCATORS = {
    titleHeading: '#movie-details-title',
    synopsis: '#movie-details-synopsis',
    selectShowtimeBtn: '#select-showtime-btn',
    backToMoviesBtn: '#back-to-movies-btn',
  };

  constructor(page: Page, healer: SelfHealingEngine) {
    super(page, healer);
  }

  public async getTitle(): Promise<string> {
    await this.waitForView('movie-details');
    return this.getText('titleHeading', MovieDetailsPage.LOCATORS.titleHeading);
  }

  public async getSynopsis(): Promise<string> {
    await this.waitForView('movie-details');
    return this.getText('synopsis', MovieDetailsPage.LOCATORS.synopsis);
  }

  public async clickSelectShowtime(): Promise<void> {
    await this.waitForView('movie-details');
    await this.click('selectShowtimeBtn', MovieDetailsPage.LOCATORS.selectShowtimeBtn);
    await this.waitForView('showtimes');
  }

  public async clickBackToMovies(): Promise<void> {
    await this.waitForView('movie-details');
    await this.click('backToMoviesBtn', MovieDetailsPage.LOCATORS.backToMoviesBtn);
    await this.waitForView('movies');
  }
}
