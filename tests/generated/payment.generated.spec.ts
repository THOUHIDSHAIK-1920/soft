/**
 * Auto-generated Playwright specification by Module 1 (AI Script Generator).
 * Module: Payment
 * Test Cases: TC-GEN-009
 */
import { test, expect } from '../../src/fixtures/testFixture';

test.describe("AI Generated — Payment Suite", () => {
  test("[TC-GEN-009] Reject invalid credit card number and CVV on payment checkout @regression", async ({
    loginPage,
    movieListPage,
    movieDetailsPage,
    showtimePage,
    seatMapPage,
    paymentPage,
    confirmationPage,
  }) => {
    // Step 1: Select seats E1 and E2 on ST-101 and proceed to payment
    // Step 2: Enter invalid card number "1234" and CVV "9"
    // Step 3: Click Pay Now
    // Step 4: Verify payment error message is displayed and booking is not confirmed

    await loginPage.loginAsDefaultUser();
    await movieListPage.openMovieDetails(1);
    await movieDetailsPage.clickSelectShowtime();
    await showtimePage.selectShowtime('ST-101');
    await seatMapPage.selectSeats(["E1","E2"]);
    await seatMapPage.proceedToPayment();
    await paymentPage.fillPaymentDetails({
      cardHolder: 'Alice Johnson',
      cardNumber: "1234",
      expiry: '12/28',
      cvv: "9",
    });
    await paymentPage.submitPayment();
    const paymentErr = await paymentPage.getPaymentErrorLocator();
    await expect(paymentErr, 'BUG-07: Invalid card details must trigger payment validation error').toBeVisible();
  });
});
