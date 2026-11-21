/**
 * Auto-generated Playwright specification by Module 1 (AI Script Generator).
 * Module: SeatMap
 * Test Cases: TC-GEN-006, TC-GEN-007, TC-GEN-008, TC-GEN-011
 */
import { test, expect } from '../../src/fixtures/testFixture';

test.describe("AI Generated — SeatMap Suite", () => {
  test("[TC-GEN-006] Select two available seats and verify dynamic counts and total price @smoke @regression", async ({
    loginPage,
    movieListPage,
    movieDetailsPage,
    showtimePage,
    seatMapPage,
    paymentPage,
    confirmationPage,
  }) => {
    // Step 1: Open seat map for Interstellar Odyssey (ST-101)
    // Step 2: Verify initial available count is 86 and booked count is 14
    // Step 3: Select seats C1 and C2
    // Step 4: Verify selected count is 2, available count is 84, and total price is $28.00

    await loginPage.loginAsDefaultUser();
    await movieListPage.openMovieDetails(1);
    await movieDetailsPage.clickSelectShowtime();
    await showtimePage.selectShowtime("ST-101");
    const initial = await seatMapPage.getSeatCounts();
    expect(initial.totalSeats).toBe(100);
    expect(initial.booked).toBe(14);
    expect(initial.available).toBe(86);
    await seatMapPage.selectSeats(["C1","C2"]);
    const updated = await seatMapPage.getSeatCounts();
    expect(updated.selected).toBe(2);
    expect(updated.available).toBe(84);
    const totalPrice = await seatMapPage.getTotalPriceText();
    expect(totalPrice, 'BUG-02: Total price must equal ticket count x unit price').toBe("$28.00");
  });

  test("[TC-GEN-007] Prevent selection of pre-booked seats on the 10x10 seat map @regression", async ({
    loginPage,
    movieListPage,
    movieDetailsPage,
    showtimePage,
    seatMapPage,
    paymentPage,
    confirmationPage,
  }) => {
    // Step 1: Open seat map for ST-101
    // Step 2: Inspect pre-booked seat A1
    // Step 3: Verify seat A1 is disabled and cannot enter selected state

    await loginPage.loginAsDefaultUser();
    await movieListPage.openMovieDetails(1);
    await movieDetailsPage.clickSelectShowtime();
    await showtimePage.selectShowtime("ST-101");
    const bookedSeat = await seatMapPage.getSeatLocator("A1");
    await expect(bookedSeat, 'BUG-01: Pre-booked seat must be disabled').toBeDisabled();
    await expect(bookedSeat).toHaveAttribute('data-status', 'booked');
  });

  test("[TC-GEN-008] Enforce maximum 6 seats limit when attempting to select a 7th seat @regression", async ({
    loginPage,
    movieListPage,
    movieDetailsPage,
    showtimePage,
    seatMapPage,
    paymentPage,
    confirmationPage,
  }) => {
    // Step 1: Open seat map for ST-101
    // Step 2: Select 6 available seats: C1, C2, C3, D1, D2, D3
    // Step 3: Attempt to click a 7th available seat D4
    // Step 4: Verify seat limit error message appears and selected count remains 6

    await loginPage.loginAsDefaultUser();
    await movieListPage.openMovieDetails(1);
    await movieDetailsPage.clickSelectShowtime();
    await showtimePage.selectShowtime("ST-101");
    await seatMapPage.selectSeats(["C1","C2","C3","D1","D2","D3","D4"]);
    const seatErr = await seatMapPage.getSeatErrorLocator();
    await expect(seatErr, 'BUG-03: Selecting a 7th seat must trigger max 6 seat error').toBeVisible();
    const counts = await seatMapPage.getSeatCounts();
    expect(counts.selected, 'BUG-03: Selected seat count must not exceed 6').toBe(6);
  });

  test("[TC-GEN-011] Boundary test allowing exactly 6 seats with accurate total calculation @regression", async ({
    loginPage,
    movieListPage,
    movieDetailsPage,
    showtimePage,
    seatMapPage,
    paymentPage,
    confirmationPage,
  }) => {
    // Step 1: Sign in and open Quantum Horizon showtime ST-201 ($12/ticket)
    // Step 2: Select exactly 6 seats: G1, G2, G3, G4, G5, G6
    // Step 3: Verify selected count is 6, total is $72.00, and Proceed to Payment is enabled

    await loginPage.loginAsDefaultUser();
    await movieListPage.openMovieDetails(2);
    await movieDetailsPage.clickSelectShowtime();
    await showtimePage.selectShowtime("ST-201");
    await seatMapPage.selectSeats(["G1","G2","G3","G4","G5","G6"]);
    const counts = await seatMapPage.getSeatCounts();
    expect(counts.selected).toBe(6);
    const total = await seatMapPage.getTotalPriceText();
    expect(total, 'BUG-02: Boundary 6-seat total price must match 6 x $12.00').toBe("$72.00");
    await expect(await seatMapPage.getProceedButton()).toBeEnabled();
  });
});
