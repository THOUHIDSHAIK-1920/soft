import { Locator, Page } from '@playwright/test';
import { SelfHealingEngine } from '../fixtures/selfHealing';
import { BasePage } from './BasePage';

export class MovieListPage extends BasePage {
  protected readonly pageName = 'MovieList';

  // Centralized locators
  public static readonly LOCATORS = {
    searchInput: '#search-movies-input',
    genreSelect: '#genre-filter-select',
    searchButton: '#search-movies-btn',
    moviesGrid: '#movies-grid',
    movieCard: '.movie-card',
    viewDetailsBtn: (movieId: number) => `#view-movie-${movieId}`,
  };

  constructor(page: Page, healer: SelfHealingEngine) {
    super(page, healer);
  }

  public async searchMovies(query: string): Promise<void> {
    await this.waitForView('movies');
    await this.fill('searchInput', MovieListPage.LOCATORS.searchInput, query);
    await this.click('searchButton', MovieListPage.LOCATORS.searchButton);
    await this.page.waitForTimeout(250);
  }

  public async filterByGenre(genre: string): Promise<void> {
    await this.waitForView('movies');
    await this.selectOption('genreSelect', MovieListPage.LOCATORS.genreSelect, genre);
    await this.page.waitForTimeout(250);
  }

  public async getMovieCards(): Promise<Locator> {
    await this.waitForView('movies');
    return this.locatorAll('movieCard', MovieListPage.LOCATORS.movieCard);
  }

  public async getMovieCount(): Promise<number> {
    const cards = await this.getMovieCards();
    return cards.count();
  }

  public async getDisplayedMovieTitles(): Promise<string[]> {
    const cards = await this.getMovieCards();
    return cards.locator('.movie-title').allTextContents();
  }

  public async openMovieDetails(movieId: number): Promise<void> {
    await this.waitForView('movies');
    await this.click(`viewDetailsBtn_${movieId}`, MovieListPage.LOCATORS.viewDetailsBtn(movieId));
    await this.waitForView('movie-details');
  }
}
