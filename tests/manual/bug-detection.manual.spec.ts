import { test, expect } from '../../src/fixtures/testFixture';

test.describe('Manual Baseline — Core Business Rules & Defect Verification', () => {
  test('Manual: Search filters movies by title [BUG-06] @regression', async ({
    loginPage,
    movieListPage,
  }) => {
    await loginPage.loginAsDefaultUser();
    await movieListPage.searchMovies('Interstellar');
    expect(await movieListPage.getMovieCount(), 'BUG-06: Search should return 1 movie').toBe(1);
  });

  test('Manual: Sold-out showtime is disabled [BUG-08] @regression', async ({
    loginPage,
    movieListPage,
    movieDetailsPage,
    showtimePage,
  }) => {
    await loginPage.loginAsDefaultUser();
    await movieListPage.openMovieDetails(1);
    await movieDetailsPage.clickSelectShowtime();
    const soldOutBtn = await showtimePage.getShowtimeButton('ST-103');
    await expect(soldOutBtn, 'BUG-08: Sold-out showtime ST-103 must be disabled').toBeDisabled();
  });

  test('Manual: Seat selection enforces maximum 6 seats limit [BUG-03] @regression', async ({
    loginPage,
    movieListPage,
    movieDetailsPage,
    showtimePage,
    seatMapPage,
  }) => {
    await loginPage.loginAsDefaultUser();
    await movieListPage.openMovieDetails(2);
    await movieDetailsPage.clickSelectShowtime();
    await showtimePage.selectShowtime('ST-201');
    await seatMapPage.selectSeats(['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7']);
    const err = await seatMapPage.getSeatErrorLocator();
    await expect(err, 'BUG-03: Max 6 seats validation alert must appear').toBeVisible();
    const counts = await seatMapPage.getSeatCounts();
    expect(counts.selected).toBe(6);
  });

  test('Manual: Payment rejects invalid credit card number [BUG-07] @regression', async ({
    loginPage,
    movieListPage,
    movieDetailsPage,
    showtimePage,
    seatMapPage,
    paymentPage,
  }) => {
    await loginPage.loginAsDefaultUser();
    await movieListPage.openMovieDetails(2);
    await movieDetailsPage.clickSelectShowtime();
    await showtimePage.selectShowtime('ST-201');
    await seatMapPage.selectSeats(['J5']);
    await seatMapPage.proceedToPayment();
    await paymentPage.fillPaymentDetails({
      cardHolder: 'Bob Martinez',
      cardNumber: '9999',
      expiry: '01/29',
      cvv: '1',
    });
    await paymentPage.submitPayment();
    const err = await paymentPage.getPaymentErrorLocator();
    await expect(err, 'BUG-07: Invalid card must show payment error').toBeVisible();
  });
});
