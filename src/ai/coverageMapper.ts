import fs from 'fs';
import path from 'path';
import { PATHS, writeJson } from '../config';
import { AppModule, CoverageReport } from '../types';

interface FeatureDefinition {
  page: AppModule;
  feature: string;
  keywords: string[];
}

const FEATURE_CATALOG: FeatureDefinition[] = [
  { page: 'Login', feature: 'Valid User Authentication', keywords: ['login_valid', 'valid registered', 'valid login', 'loginAsDefaultUser'] },
  { page: 'Login', feature: 'Invalid/Empty Credential Rejection', keywords: ['login_invalid', 'invalid or empty login', 'BUG-05', 'getErrorBanner'] },
  { page: 'MovieList', feature: 'Movie Catalog Listing', keywords: ['getMovieCount', 'Now Showing'] },
  { page: 'MovieList', feature: 'Movie Title Search Filtering', keywords: ['searchMovies', 'BUG-06'] },
  { page: 'MovieList', feature: 'Genre Filter & Catalog Roundtrip', keywords: ['filterByGenre', 'clickBackToMovies'] },
  { page: 'MovieDetails', feature: 'Movie Metadata & Synopsis Display', keywords: ['movieDetailsPage.getTitle', 'getSynopsis'] },
  { page: 'MovieDetails', feature: 'Showtime Navigation CTA', keywords: ['clickSelectShowtime'] },
  { page: 'Showtime', feature: 'Available Theatre & Screening Selection', keywords: ['selectShowtime'] },
  { page: 'Showtime', feature: 'Sold-Out Showtime Protection', keywords: ['ST-103', 'BUG-08', 'toBeDisabled'] },
  { page: 'SeatMap', feature: '10x10 Seat Grid Visual & DOM Verification', keywords: ['toHaveScreenshot', 'getDomStatusCounts', 'getSeatCounts'] },
  { page: 'SeatMap', feature: 'Dynamic Seat Selection & Pricing', keywords: ['getTotalPriceText', 'BUG-02'] },
  { page: 'SeatMap', feature: 'Booked Seat Unselectable Guard', keywords: ['bookedSeat', 'BUG-01', 'seat_booked_blocked'] },
  { page: 'SeatMap', feature: 'Max 6 Seats Limit & Boundary Enforcement', keywords: ['seat_limit_exceeded', 'seat_limit_boundary_6', 'BUG-03'] },
  { page: 'Payment', feature: 'Valid Mock Card Checkout', keywords: ['payWithValidCard'] },
  { page: 'Payment', feature: 'Invalid Card / CVV Validation', keywords: ['payment_invalid_card', 'BUG-07', 'getPaymentErrorLocator'] },
  { page: 'Confirmation', feature: 'Booking Reference & Receipt Display', keywords: ['getConfirmationBanner', 'getBookingReferenceLocator', 'BUG-04'] },
];

function collectSpecContents(dir: string, labelPrefix: string): Array<{ name: string; content: string }> {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.spec.ts'))
    .map((f) => ({
      name: `${labelPrefix}/${f}`,
      content: fs.readFileSync(path.join(dir, f), 'utf-8'),
    }));
}

export function runCoverageMapper(): CoverageReport {
  const specs = [
    ...collectSpecContents(PATHS.manualTestsDir, 'tests/manual'),
    ...collectSpecContents(PATHS.generatedTestsDir, 'tests/generated'),
  ];

  const pagesMap = new Map<AppModule, CoverageReport['pages'][number]['features']>();
  let coveredFeatures = 0;

  for (const def of FEATURE_CATALOG) {
    const matchedTests = specs
      .filter((spec) => def.keywords.some((kw) => spec.content.includes(kw)))
      .map((s) => s.name);

    const covered = matchedTests.length > 0;
    if (covered) coveredFeatures++;

    const list = pagesMap.get(def.page) || [];
    list.push({
      name: def.feature,
      covered,
      tests: matchedTests,
    });
    pagesMap.set(def.page, list);
  }

  const totalFeatures = FEATURE_CATALOG.length;
  const automationCoverage = totalFeatures > 0 ? Number((coveredFeatures / totalFeatures).toFixed(4)) : 0;

  const report: CoverageReport = {
    timestamp: new Date().toISOString(),
    totalFeatures,
    coveredFeatures,
    automationCoverage,
    pages: Array.from(pagesMap.entries()).map(([page, features]) => ({ page, features })),
  };

  writeJson(PATHS.coverageJson, report);
  console.log(
    `[Module 1] Coverage Mapper: ${coveredFeatures}/${totalFeatures} features covered (${(automationCoverage * 100).toFixed(1)}% automation coverage) -> reports/coverage.json`
  );
  return report;
}

if (require.main === module) {
  runCoverageMapper();
}
