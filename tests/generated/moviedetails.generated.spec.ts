/**
 * Auto-generated Playwright specification by Module 1 (AI Script Generator).
 * Module: MovieDetails
 * Test Cases: TC-GEN-004
 */
import { test, expect } from '../../src/fixtures/testFixture';

test.describe("AI Generated — MovieDetails Suite", () => {
  test("[TC-GEN-004] Inspect movie details metadata and proceed to showtime selection @smoke @regression", async ({
    loginPage,
    movieListPage,
    movieDetailsPage,
    showtimePage,
    seatMapPage,
    paymentPage,
    confirmationPage,
  }) => {
    // Step 1: Sign in and locate Interstellar Odyssey in movie list
    // Step 2: Click View Details for movie ID 1
    // Step 3: Verify title, synopsis, and Select Showtime button are visible

    await loginPage.loginAsDefaultUser();
    await movieListPage.openMovieDetails(1);
    const title = await movieDetailsPage.getTitle();
    expect(title).toBe("Interstellar Odyssey");
    const synopsis = await movieDetailsPage.getSynopsis();
    expect(synopsis.length).toBeGreaterThan(20);
    await movieDetailsPage.clickSelectShowtime();
    await showtimePage.waitForView('showtimes');
  });
});
