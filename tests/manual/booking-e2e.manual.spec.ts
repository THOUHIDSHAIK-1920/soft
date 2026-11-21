import { test, expect } from '../../src/fixtures/testFixture';

test.describe('Manual Baseline — End-to-End Movie Booking Workflow', () => {
  test('Manual: Full E2E booking workflow from login to confirmation [BUG-02][BUG-04] @smoke @regression', async ({
    loginPage,
    movieListPage,
    movieDetailsPage,
    showtimePage,
    seatMapPage,
    paymentPage,
    confirmationPage,
  }) => {
    await loginPage.loginAsDefaultUser();

    // Browse & open Interstellar Odyssey ($14/ticket)
    await movieListPage.openMovieDetails(1);
    expect(await movieDetailsPage.getTitle()).toBe('Interstellar Odyssey');
    await movieDetailsPage.clickSelectShowtime();

    // Pick available IMAX showtime ST-101
    await showtimePage.selectShowtime('ST-101');

    // Select 2 available seats -> $28.00
    await seatMapPage.selectSeats(['H5', 'H6']);
    expect(await seatMapPage.getTotalPriceText(), 'BUG-02: Seat map total must be $28.00').toBe('$28.00');
    await seatMapPage.proceedToPayment();

    // Complete mock payment
    expect(await paymentPage.getPaymentTotalText(), 'BUG-02: Payment total must be $28.00').toBe('$28.00');
    await paymentPage.payWithValidCard('Alice Johnson');

    // Verify confirmation page
    const banner = await confirmationPage.getConfirmationBanner();
    await expect(banner, 'BUG-04: Confirmation banner must be visible').toBeVisible();
    const ref = await confirmationPage.getBookingReferenceLocator();
    await expect(ref, 'BUG-04: Booking reference ID must start with CB-').toContainText(/^CB-/);
    expect(await confirmationPage.getConfirmationTotalText()).toBe('$28.00');

    // Return to movie catalog
    await confirmationPage.clickBookAnother();
    expect(await movieListPage.getMovieCount()).toBe(6);
  });
});
