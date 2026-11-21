/**
 * Auto-generated Playwright specification by Module 1 (AI Script Generator).
 * Module: Confirmation
 * Test Cases: TC-GEN-010
 */
import { test, expect } from '../../src/fixtures/testFixture';

test.describe("AI Generated — Confirmation Suite", () => {
  test("[TC-GEN-010] End-to-end movie ticket booking displays confirmation reference and total @smoke @regression", async ({
    loginPage,
    movieListPage,
    movieDetailsPage,
    showtimePage,
    seatMapPage,
    paymentPage,
    confirmationPage,
  }) => {
    // Step 1: Sign in as alice@cinebook.com
    // Step 2: Choose Interstellar Odyssey and showtime ST-101
    // Step 3: Select seats F1 and F2 and proceed to payment
    // Step 4: Submit valid mock card details and verify booking confirmation reference CB-* and $28.00 total

    await loginPage.loginAsDefaultUser();
    await movieListPage.openMovieDetails(1);
    await movieDetailsPage.clickSelectShowtime();
    await showtimePage.selectShowtime("ST-101");
    await seatMapPage.selectSeats(["F1","F2"]);
    await seatMapPage.proceedToPayment();
    await paymentPage.payWithValidCard('Alice Johnson');
    const banner = await confirmationPage.getConfirmationBanner();
    await expect(banner, 'BUG-04: Booking confirmation banner must be visible').toBeVisible();
    const refLoc = await confirmationPage.getBookingReferenceLocator();
    await expect(refLoc, 'BUG-04: Booking reference CB-* must be displayed').toContainText(/^CB-/);
    const paidTotal = await confirmationPage.getConfirmationTotalText();
    expect(paidTotal, 'BUG-02: Confirmed total paid must match exact seat price').toBe("$28.00");
  });
});
