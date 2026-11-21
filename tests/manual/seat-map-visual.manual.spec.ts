import { test, expect } from '../../src/fixtures/testFixture';

test.describe('Manual Baseline — Seat Map Visual & DOM Assertions', () => {
  test('Manual: 10x10 seat map visual screenshot comparison and initial DOM counts @smoke @regression', async ({
    loginPage,
    movieListPage,
    movieDetailsPage,
    showtimePage,
    seatMapPage,
  }) => {
    await loginPage.loginAsDefaultUser();
    await movieListPage.openMovieDetails(3); // Neon Drift (dedicated showtime ST-301)
    await movieDetailsPage.clickSelectShowtime();
    await showtimePage.selectShowtime('ST-301');

    const grid = await seatMapPage.getSeatGrid();
    await expect(grid).toBeVisible();

    // Visual regression test of the 10x10 seat grid
    await expect(grid).toHaveScreenshot('seat-map-10x10.png', {
      maxDiffPixelRatio: 0.03,
    });

    // DOM count assertions (summary counters + data-status attributes)
    const summaryCounts = await seatMapPage.getSeatCounts();
    const domCounts = await seatMapPage.getDomStatusCounts();

    expect(summaryCounts.totalSeats).toBe(100);
    expect(summaryCounts.available).toBe(86);
    expect(summaryCounts.booked).toBe(14);
    expect(summaryCounts.selected).toBe(0);

    expect(domCounts.available).toBe(86);
    expect(domCounts.booked).toBe(14);
    expect(domCounts.selected).toBe(0);

    // Select 2 available seats and verify state transition
    await seatMapPage.selectSeats(['J1', 'J2']);
    const afterSelect = await seatMapPage.getDomStatusCounts();
    expect(afterSelect.selected).toBe(2);
    expect(afterSelect.available).toBe(84);
    expect(afterSelect.booked).toBe(14);
  });

  test('Manual: Booked seats cannot be selected on 10x10 seat map [BUG-01] @regression', async ({
    loginPage,
    movieListPage,
    movieDetailsPage,
    showtimePage,
    seatMapPage,
  }) => {
    await loginPage.loginAsDefaultUser();
    await movieListPage.openMovieDetails(1);
    await movieDetailsPage.clickSelectShowtime();
    await showtimePage.selectShowtime('ST-101');

    const bookedSeat = await seatMapPage.getSeatLocator('A1');
    await expect(bookedSeat, 'BUG-01: Pre-booked seat A1 must be disabled').toBeDisabled();
    await expect(bookedSeat).toHaveAttribute('data-status', 'booked');

    const secondBooked = await seatMapPage.getSeatLocator('B5');
    await expect(secondBooked, 'BUG-01: Pre-booked seat B5 must be disabled').toBeDisabled();
  });
});
