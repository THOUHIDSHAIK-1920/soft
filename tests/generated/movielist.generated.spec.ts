/**
 * Auto-generated Playwright specification by Module 1 (AI Script Generator).
 * Module: MovieList
 * Test Cases: TC-GEN-003, TC-GEN-012
 */
import { test, expect } from '../../src/fixtures/testFixture';

test.describe("AI Generated — MovieList Suite", () => {
  test("[TC-GEN-003] Filter movie catalog accurately using search query @smoke @regression", async ({
    loginPage,
    movieListPage,
    movieDetailsPage,
    showtimePage,
    seatMapPage,
    paymentPage,
    confirmationPage,
  }) => {
    // Step 1: Sign in with valid credentials
    // Step 2: Type "Quantum" into the movie search input
    // Step 3: Click Search button
    // Step 4: Verify only 1 matching movie ("Quantum Horizon") is displayed

    await loginPage.loginAsDefaultUser();
    await movieListPage.searchMovies("Quantum");
    const count = await movieListPage.getMovieCount();
    expect(count, 'BUG-06: Movie search must filter results accurately').toBe(1);
    const titles = await movieListPage.getDisplayedMovieTitles();
    expect(titles).toContain("Quantum Horizon");
  });

  test("[TC-GEN-012] Filter movies by Animation genre and roundtrip movie details navigation @regression", async ({
    loginPage,
    movieListPage,
    movieDetailsPage,
    showtimePage,
    seatMapPage,
    paymentPage,
    confirmationPage,
  }) => {
    // Step 1: Sign in and select Animation from genre filter
    // Step 2: Verify Skyward Chronicles is displayed
    // Step 3: Open Movie Details and return to catalog via Back to Movies

    await loginPage.loginAsDefaultUser();
    await movieListPage.filterByGenre("Animation");
    const count = await movieListPage.getMovieCount();
    expect(count, 'BUG-06: Genre filter must isolate matching movies').toBe(1);
    await movieListPage.openMovieDetails(6);
    const title = await movieDetailsPage.getTitle();
    expect(title).toBe("Skyward Chronicles");
    await movieDetailsPage.clickBackToMovies();
    await movieListPage.waitForView('movies');
  });
});
