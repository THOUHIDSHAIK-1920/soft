import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { PATHS, PROJECT_ROOT, ensureDir, readJsonSafe, writeJson } from '../config';
import { GenerationValidationReport, StructuredTestCase } from '../types';

function buildTestBody(tc: StructuredTestCase): string {
  const data = tc.testData || {};
  switch (tc.templateAction) {
    case 'login_valid':
      return `
    await loginPage.goto();
    await loginPage.login(${JSON.stringify(String(data.email || 'alice@cinebook.com'))}, ${JSON.stringify(String(data.password || 'Cinema@123'))});
    await movieListPage.waitForView('movies');
    const movieCount = await movieListPage.getMovieCount();
    expect(movieCount).toBe(6);`;

    case 'login_invalid':
      return `
    await loginPage.goto();
    await loginPage.login(${JSON.stringify(String(data.email || 'wrong@cinebook.com'))}, ${JSON.stringify(String(data.password || 'badpass'))});
    const errorBanner = await loginPage.getErrorBanner();
    await expect(errorBanner, 'BUG-05: Invalid credentials must show authentication error').toBeVisible();`;

    case 'movie_search':
      return `
    await loginPage.loginAsDefaultUser();
    await movieListPage.searchMovies(${JSON.stringify(String(data.query || 'Quantum'))});
    const count = await movieListPage.getMovieCount();
    expect(count, 'BUG-06: Movie search must filter results accurately').toBe(${Number(data.expectedCount || 1)});
    const titles = await movieListPage.getDisplayedMovieTitles();
    expect(titles).toContain(${JSON.stringify(String(data.expectedTitle || 'Quantum Horizon'))});`;

    case 'movie_genre_filter':
      return `
    await loginPage.loginAsDefaultUser();
    await movieListPage.filterByGenre(${JSON.stringify(String(data.genre || 'Animation'))});
    const count = await movieListPage.getMovieCount();
    expect(count, 'BUG-06: Genre filter must isolate matching movies').toBe(1);
    await movieListPage.openMovieDetails(${Number(data.movieId || 6)});
    const title = await movieDetailsPage.getTitle();
    expect(title).toBe(${JSON.stringify(String(data.expectedTitle || 'Skyward Chronicles'))});
    await movieDetailsPage.clickBackToMovies();
    await movieListPage.waitForView('movies');`;

    case 'movie_details':
      return `
    await loginPage.loginAsDefaultUser();
    await movieListPage.openMovieDetails(${Number(data.movieId || 1)});
    const title = await movieDetailsPage.getTitle();
    expect(title).toBe(${JSON.stringify(String(data.expectedTitle || 'Interstellar Odyssey'))});
    const synopsis = await movieDetailsPage.getSynopsis();
    expect(synopsis.length).toBeGreaterThan(20);
    await movieDetailsPage.clickSelectShowtime();
    await showtimePage.waitForView('showtimes');`;

    case 'showtime_soldout_check':
      return `
    await loginPage.loginAsDefaultUser();
    await movieListPage.openMovieDetails(${Number(data.movieId || 1)});
    await movieDetailsPage.clickSelectShowtime();
    const soldOutBtn = await showtimePage.getShowtimeButton(${JSON.stringify(String(data.soldOutShowtimeId || 'ST-103'))});
    await expect(soldOutBtn, 'BUG-08: Sold-out showtime must be disabled').toBeDisabled();
    await showtimePage.selectShowtime(${JSON.stringify(String(data.availableShowtimeId || 'ST-101'))});
    await expect(await seatMapPage.getSeatGrid()).toBeVisible();`;

    case 'seat_selection_price': {
      const seats = Array.isArray(data.seats) ? data.seats : ['C1', 'C2'];
      return `
    await loginPage.loginAsDefaultUser();
    await movieListPage.openMovieDetails(1);
    await movieDetailsPage.clickSelectShowtime();
    await showtimePage.selectShowtime(${JSON.stringify(String(data.showtimeId || 'ST-101'))});
    const initial = await seatMapPage.getSeatCounts();
    expect(initial.totalSeats).toBe(100);
    expect(initial.booked).toBe(14);
    expect(initial.available).toBe(86);
    await seatMapPage.selectSeats(${JSON.stringify(seats)});
    const updated = await seatMapPage.getSeatCounts();
    expect(updated.selected).toBe(${seats.length});
    expect(updated.available).toBe(${86 - seats.length});
    const totalPrice = await seatMapPage.getTotalPriceText();
    expect(totalPrice, 'BUG-02: Total price must equal ticket count x unit price').toBe(${JSON.stringify(String(data.expectedTotal || '$28.00'))});`;
    }

    case 'seat_booked_blocked':
      return `
    await loginPage.loginAsDefaultUser();
    await movieListPage.openMovieDetails(1);
    await movieDetailsPage.clickSelectShowtime();
    await showtimePage.selectShowtime(${JSON.stringify(String(data.showtimeId || 'ST-101'))});
    const bookedSeat = await seatMapPage.getSeatLocator(${JSON.stringify(String(data.bookedSeat || 'A1'))});
    await expect(bookedSeat, 'BUG-01: Pre-booked seat must be disabled').toBeDisabled();
    await expect(bookedSeat).toHaveAttribute('data-status', 'booked');`;

    case 'seat_limit_exceeded': {
      const seats = Array.isArray(data.seats) ? data.seats : ['C1', 'C2', 'C3', 'D1', 'D2', 'D3', 'D4'];
      return `
    await loginPage.loginAsDefaultUser();
    await movieListPage.openMovieDetails(1);
    await movieDetailsPage.clickSelectShowtime();
    await showtimePage.selectShowtime(${JSON.stringify(String(data.showtimeId || 'ST-101'))});
    await seatMapPage.selectSeats(${JSON.stringify(seats)});
    const seatErr = await seatMapPage.getSeatErrorLocator();
    await expect(seatErr, 'BUG-03: Selecting a 7th seat must trigger max 6 seat error').toBeVisible();
    const counts = await seatMapPage.getSeatCounts();
    expect(counts.selected, 'BUG-03: Selected seat count must not exceed 6').toBe(6);`;
    }

    case 'seat_limit_boundary_6': {
      const seats = Array.isArray(data.seats) ? data.seats : ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'];
      return `
    await loginPage.loginAsDefaultUser();
    await movieListPage.openMovieDetails(${Number(data.movieId || 2)});
    await movieDetailsPage.clickSelectShowtime();
    await showtimePage.selectShowtime(${JSON.stringify(String(data.showtimeId || 'ST-201'))});
    await seatMapPage.selectSeats(${JSON.stringify(seats)});
    const counts = await seatMapPage.getSeatCounts();
    expect(counts.selected).toBe(6);
    const total = await seatMapPage.getTotalPriceText();
    expect(total, 'BUG-02: Boundary 6-seat total price must match 6 x $12.00').toBe(${JSON.stringify(String(data.expectedTotal || '$72.00'))});
    await expect(await seatMapPage.getProceedButton()).toBeEnabled();`;
    }

    case 'payment_invalid_card': {
      const seats = Array.isArray(data.seats) ? data.seats : ['E1', 'E2'];
      return `
    await loginPage.loginAsDefaultUser();
    await movieListPage.openMovieDetails(1);
    await movieDetailsPage.clickSelectShowtime();
    await showtimePage.selectShowtime('ST-101');
    await seatMapPage.selectSeats(${JSON.stringify(seats)});
    await seatMapPage.proceedToPayment();
    await paymentPage.fillPaymentDetails({
      cardHolder: 'Alice Johnson',
      cardNumber: ${JSON.stringify(String(data.cardNumber || '1234'))},
      expiry: '12/28',
      cvv: ${JSON.stringify(String(data.cvv || '9'))},
    });
    await paymentPage.submitPayment();
    const paymentErr = await paymentPage.getPaymentErrorLocator();
    await expect(paymentErr, 'BUG-07: Invalid card details must trigger payment validation error').toBeVisible();`;
    }

    case 'booking_e2e_confirmation': {
      const seats = Array.isArray(data.seats) ? data.seats : ['F1', 'F2'];
      return `
    await loginPage.loginAsDefaultUser();
    await movieListPage.openMovieDetails(${Number(data.movieId || 1)});
    await movieDetailsPage.clickSelectShowtime();
    await showtimePage.selectShowtime(${JSON.stringify(String(data.showtimeId || 'ST-101'))});
    await seatMapPage.selectSeats(${JSON.stringify(seats)});
    await seatMapPage.proceedToPayment();
    await paymentPage.payWithValidCard('Alice Johnson');
    const banner = await confirmationPage.getConfirmationBanner();
    await expect(banner, 'BUG-04: Booking confirmation banner must be visible').toBeVisible();
    const refLoc = await confirmationPage.getBookingReferenceLocator();
    await expect(refLoc, 'BUG-04: Booking reference CB-* must be displayed').toContainText(/^CB-/);
    const paidTotal = await confirmationPage.getConfirmationTotalText();
    expect(paidTotal, 'BUG-02: Confirmed total paid must match exact seat price').toBe(${JSON.stringify(String(data.expectedTotal || '$28.00'))});`;
    }
  }
}

function renderSpecFile(moduleName: string, cases: StructuredTestCase[]): string {
  const testBlocks = cases
    .map((tc) => {
      const tagStr = tc.tags.join(' ');
      const stepComments = tc.steps.map((s, idx) => `    // Step ${idx + 1}: ${s}`).join('\n');
      return `
  test(${JSON.stringify(`[${tc.id}] ${tc.title} ${tagStr}`)}, async ({
    loginPage,
    movieListPage,
    movieDetailsPage,
    showtimePage,
    seatMapPage,
    paymentPage,
    confirmationPage,
  }) => {
${stepComments}
${buildTestBody(tc)}
  });`;
    })
    .join('\n');

  return `/**
 * Auto-generated Playwright specification by Module 1 (AI Script Generator).
 * Module: ${moduleName}
 * Test Cases: ${cases.map((c) => c.id).join(', ')}
 */
import { test, expect } from '../../src/fixtures/testFixture';

test.describe(${JSON.stringify(`AI Generated — ${moduleName} Suite`)}, () => {${testBlocks}
});
`;
}

export function runScriptGenerator(): GenerationValidationReport {
  const payload = readJsonSafe<{ testCases: StructuredTestCase[] }>(PATHS.testcasesJson, { testCases: [] });
  const testCases = payload.testCases || [];
  if (testCases.length === 0) {
    throw new Error('No test cases found in reports/testcases.json. Run testCaseGenerator first.');
  }

  ensureDir(PATHS.generatedTestsDir);
  // Clean old generated specs before regenerating
  for (const existing of fs.readdirSync(PATHS.generatedTestsDir)) {
    if (existing.endsWith('.spec.ts')) {
      fs.unlinkSync(path.join(PATHS.generatedTestsDir, existing));
    }
  }

  // Group test cases by module
  const grouped = new Map<string, StructuredTestCase[]>();
  for (const tc of testCases) {
    const list = grouped.get(tc.module) || [];
    list.push(tc);
    grouped.set(tc.module, list);
  }

  const generatedFiles: Array<{ file: string; relPath: string; testCaseIds: string[] }> = [];
  for (const [moduleName, cases] of grouped.entries()) {
    const fileName = `${moduleName.toLowerCase()}.generated.spec.ts`;
    const fullPath = path.join(PATHS.generatedTestsDir, fileName);
    fs.writeFileSync(fullPath, renderSpecFile(moduleName, cases), 'utf-8');
    generatedFiles.push({
      file: fileName,
      relPath: `tests/generated/${fileName}`,
      testCaseIds: cases.map((c) => c.id),
    });
  }

  // Validate generated specs: (1) TypeScript compilation with tsc, (2) Playwright dry run (--list)
  let globalTscOk = true;
  let globalTscErr = '';
  try {
    execSync('npx tsc --noEmit', { cwd: PROJECT_ROOT, stdio: 'pipe', encoding: 'utf-8' });
  } catch (err: unknown) {
    globalTscOk = false;
    globalTscErr = err instanceof Error ? err.message : String(err);
  }

  const specValidations: GenerationValidationReport['specs'] = [];
  let validCount = 0;

  for (const spec of generatedFiles) {
    let tscValid = globalTscOk;
    let dryRunValid = false;
    let error: string | undefined = globalTscOk ? undefined : globalTscErr.slice(0, 300);

    if (!globalTscOk) {
      // Check individually if global tsc failed because of another file
      try {
        execSync(`npx tsc --noEmit --esModuleInterop --skipLibCheck ${spec.relPath}`, {
          cwd: PROJECT_ROOT,
          stdio: 'pipe',
          encoding: 'utf-8',
        });
        tscValid = true;
        error = undefined;
      } catch (err: unknown) {
        tscValid = false;
        error = err instanceof Error ? err.message.slice(0, 300) : String(err);
      }
    }

    try {
      const listOut = execSync(`npx playwright test ${spec.relPath} --list`, {
        cwd: PROJECT_ROOT,
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      dryRunValid = listOut.includes('Total:') && !listOut.includes('Total: 0');
    } catch (err: unknown) {
      dryRunValid = false;
      error = err instanceof Error ? err.message.slice(0, 300) : String(err);
    }

    if (tscValid && dryRunValid) {
      validCount += spec.testCaseIds.length;
    }

    specValidations.push({
      file: spec.relPath,
      testCaseIds: spec.testCaseIds,
      tscValid,
      dryRunValid,
      error,
    });
  }

  const totalGenerated = testCases.length;
  const accuracy = totalGenerated > 0 ? Number((validCount / totalGenerated).toFixed(4)) : 0;

  const report: GenerationValidationReport = {
    timestamp: new Date().toISOString(),
    totalGenerated,
    validGenerated: validCount,
    testGenerationAccuracy: accuracy,
    specs: specValidations,
  };

  writeJson(PATHS.generationValidationJson, report);
  console.log(
    `[Module 1] Generated ${generatedFiles.length} spec files (${totalGenerated} tests). Validated: ${validCount}/${totalGenerated} (${(accuracy * 100).toFixed(1)}% generation accuracy)`
  );
  return report;
}

if (require.main === module) {
  runScriptGenerator();
}
