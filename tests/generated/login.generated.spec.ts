/**
 * Auto-generated Playwright specification by Module 1 (AI Script Generator).
 * Module: Login
 * Test Cases: TC-GEN-001, TC-GEN-002
 */
import { test, expect } from '../../src/fixtures/testFixture';

test.describe("AI Generated — Login Suite", () => {
  test("[TC-GEN-001] Successful login with valid registered credentials @smoke @regression", async ({
    loginPage,
    movieListPage,
    movieDetailsPage,
    showtimePage,
    seatMapPage,
    paymentPage,
    confirmationPage,
  }) => {
    // Step 1: Navigate to CineBook Pro login page
    // Step 2: Enter valid email alice@cinebook.com and password Cinema@123
    // Step 3: Click Sign In button
    // Step 4: Verify Now Showing movie catalog loads with 6 movies

    await loginPage.goto();
    await loginPage.login("alice@cinebook.com", "Cinema@123");
    await movieListPage.waitForView('movies');
    const movieCount = await movieListPage.getMovieCount();
    expect(movieCount).toBe(6);
  });

  test("[TC-GEN-002] Reject invalid or empty login credentials with error message @regression", async ({
    loginPage,
    movieListPage,
    movieDetailsPage,
    showtimePage,
    seatMapPage,
    paymentPage,
    confirmationPage,
  }) => {
    // Step 1: Navigate to CineBook Pro login page
    // Step 2: Enter invalid credentials wrong@cinebook.com / badpass
    // Step 3: Click Sign In button
    // Step 4: Verify login error alert is visible and user remains on Login page

    await loginPage.goto();
    await loginPage.login("wrong@cinebook.com", "badpass");
    const errorBanner = await loginPage.getErrorBanner();
    await expect(errorBanner, 'BUG-05: Invalid credentials must show authentication error').toBeVisible();
  });
});
