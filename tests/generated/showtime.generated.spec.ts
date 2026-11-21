/**
 * Auto-generated Playwright specification by Module 1 (AI Script Generator).
 * Module: Showtime
 * Test Cases: TC-GEN-005
 */
import { test, expect } from '../../src/fixtures/testFixture';

test.describe("AI Generated — Showtime Suite", () => {
  test("[TC-GEN-005] Disable sold-out showtime while allowing available screening selection @regression", async ({
    loginPage,
    movieListPage,
    movieDetailsPage,
    showtimePage,
    seatMapPage,
    paymentPage,
    confirmationPage,
  }) => {
    // Step 1: Sign in and open showtimes for Interstellar Odyssey
    // Step 2: Verify sold-out showtime ST-103 button is disabled
    // Step 3: Click Choose Seats on available showtime ST-101
    // Step 4: Verify 10x10 seat map renders

    await loginPage.loginAsDefaultUser();
    await movieListPage.openMovieDetails(1);
    await movieDetailsPage.clickSelectShowtime();
    const soldOutBtn = await showtimePage.getShowtimeButton("ST-103");
    await expect(soldOutBtn, 'BUG-08: Sold-out showtime must be disabled').toBeDisabled();
    await showtimePage.selectShowtime("ST-101");
    await expect(await seatMapPage.getSeatGrid()).toBeVisible();
  });
});
