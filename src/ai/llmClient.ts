import { CONFIG } from '../config';
import { RcaCategory, StructuredTestCase } from '../types';

export interface LlmRcaPayload {
  testTitle: string;
  module: string;
  error: string;
  stack: string;
  consoleLogs: string[];
  networkLogs: string[];
  domDiff: string;
}

export interface LlmRcaResult {
  category: RcaCategory;
  rootCause: string;
  suggestedFix: string;
  confidence: number;
  linkedBugId?: string;
}

/**
 * Pluggable LLM Client supporting:
 *  - Google Gemini REST API (when LLM_PROVIDER=gemini and GEMINI_API_KEY is set)
 *  - OpenAI Chat Completions REST API (when LLM_PROVIDER=openai and OPENAI_API_KEY is set)
 *  - Realistic deterministic Mock LLM fallback (when no API key is configured)
 */
export class PluggableLlmClient {
  public readonly activeProvider: 'gemini' | 'openai' | 'mock';

  constructor() {
    if (CONFIG.llmProvider === 'gemini' && CONFIG.geminiApiKey) {
      this.activeProvider = 'gemini';
    } else if (CONFIG.llmProvider === 'openai' && CONFIG.openaiApiKey) {
      this.activeProvider = 'openai';
    } else {
      this.activeProvider = 'mock';
    }
  }

  private async callExternalJson(systemPrompt: string, userPrompt: string): Promise<unknown> {
    if (this.activeProvider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.geminiModel}:generateContent?key=${CONFIG.geminiApiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      });
      if (!response.ok) {
        throw new Error(`Gemini API failed (${response.status}): ${await response.text()}`);
      }
      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      return JSON.parse(text);
    }

    if (this.activeProvider === 'openai') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CONFIG.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: CONFIG.openaiModel,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      if (!response.ok) {
        throw new Error(`OpenAI API failed (${response.status}): ${await response.text()}`);
      }
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content || '{}';
      return JSON.parse(text);
    }

    throw new Error('Mock mode should not call external endpoint.');
  }

  public async generateTestCasesFromScenario(
    scenarioFile: string,
    scenarioText: string
  ): Promise<StructuredTestCase[]> {
    if (this.activeProvider !== 'mock') {
      try {
        const systemPrompt = `You are a senior QA automation architect. Return ONLY valid JSON matching:
{ "testCases": [ { "id": "TC-...", "scenarioFile": "...", "title": "...", "module": "Login|MovieList|MovieDetails|Showtime|SeatMap|Payment|Confirmation", "tags": ["@smoke","@regression"], "steps": ["..."], "testData": {}, "expectedResult": "...", "priority": "P0|P1|P2", "type": "positive|negative|boundary", "templateAction": "login_valid|login_invalid|movie_search|movie_genre_filter|movie_details|showtime_soldout_check|seat_selection_price|seat_booked_blocked|seat_limit_exceeded|seat_limit_boundary_6|payment_invalid_card|booking_e2e_confirmation" } ] }`;
        const parsed = (await this.callExternalJson(
          systemPrompt,
          `Scenario file: ${scenarioFile}\n\n${scenarioText}`
        )) as { testCases?: StructuredTestCase[] };
        if (parsed && Array.isArray(parsed.testCases) && parsed.testCases.length > 0) {
          return parsed.testCases;
        }
      } catch (err) {
        console.warn(`[LLM] External provider (${this.activeProvider}) failed, falling back to Mock LLM:`, err);
      }
    }

    return this.mockGenerateTestCases(scenarioFile, scenarioText);
  }

  public async analyzeFailureRca(payload: LlmRcaPayload): Promise<LlmRcaResult> {
    if (this.activeProvider !== 'mock') {
      try {
        const systemPrompt = `You are a senior test automation root-cause analyst. Return strict JSON:
{ "category": "locator change" | "app bug" | "data issue" | "timing" | "environment", "rootCause": "...", "suggestedFix": "...", "confidence": 0.92, "linkedBugId": "BUG-01 or null" }`;
        const parsed = (await this.callExternalJson(
          systemPrompt,
          JSON.stringify(payload, null, 2)
        )) as Partial<LlmRcaResult>;
        if (parsed.category && parsed.rootCause && parsed.suggestedFix) {
          return {
            category: parsed.category,
            rootCause: parsed.rootCause,
            suggestedFix: parsed.suggestedFix,
            confidence: Number(parsed.confidence ?? 0.85),
            linkedBugId: parsed.linkedBugId || undefined,
          };
        }
      } catch (err) {
        console.warn(`[LLM] RCA call failed on ${this.activeProvider}, using Mock RCA:`, err);
      }
    }

    return this.mockAnalyzeRca(payload);
  }

  private mockGenerateTestCases(scenarioFile: string, scenarioText: string): StructuredTestCase[] {
    const lower = `${scenarioFile} ${scenarioText}`.toLowerCase();

    if (lower.includes('01-login')) {
      return [
        {
          id: 'TC-GEN-001',
          scenarioFile,
          title: 'Successful login with valid registered credentials',
          module: 'Login',
          tags: ['@smoke', '@regression'],
          steps: [
            'Navigate to CineBook Pro login page',
            'Enter valid email alice@cinebook.com and password Cinema@123',
            'Click Sign In button',
            'Verify Now Showing movie catalog loads with 6 movies',
          ],
          testData: { email: 'alice@cinebook.com', password: 'Cinema@123' },
          expectedResult: 'User is authenticated and redirected to the Now Showing movie catalog.',
          priority: 'P0',
          type: 'positive',
          templateAction: 'login_valid',
        },
        {
          id: 'TC-GEN-002',
          scenarioFile,
          title: 'Reject invalid or empty login credentials with error message',
          module: 'Login',
          tags: ['@regression'],
          steps: [
            'Navigate to CineBook Pro login page',
            'Enter invalid credentials wrong@cinebook.com / badpass',
            'Click Sign In button',
            'Verify login error alert is visible and user remains on Login page',
          ],
          testData: { email: 'wrong@cinebook.com', password: 'badpass' },
          expectedResult: 'Authentication fails with a visible error banner and access is denied.',
          priority: 'P0',
          type: 'negative',
          templateAction: 'login_invalid',
        },
      ];
    }

    if (lower.includes('02-movie-browse')) {
      return [
        {
          id: 'TC-GEN-003',
          scenarioFile,
          title: 'Filter movie catalog accurately using search query',
          module: 'MovieList',
          tags: ['@smoke', '@regression'],
          steps: [
            'Sign in with valid credentials',
            'Type "Quantum" into the movie search input',
            'Click Search button',
            'Verify only 1 matching movie ("Quantum Horizon") is displayed',
          ],
          testData: { query: 'Quantum', expectedTitle: 'Quantum Horizon', expectedCount: 1 },
          expectedResult: 'Movie list filters down to exactly Quantum Horizon.',
          priority: 'P1',
          type: 'positive',
          templateAction: 'movie_search',
        },
      ];
    }

    if (lower.includes('03-movie-details')) {
      return [
        {
          id: 'TC-GEN-004',
          scenarioFile,
          title: 'Inspect movie details metadata and proceed to showtime selection',
          module: 'MovieDetails',
          tags: ['@smoke', '@regression'],
          steps: [
            'Sign in and locate Interstellar Odyssey in movie list',
            'Click View Details for movie ID 1',
            'Verify title, synopsis, and Select Showtime button are visible',
          ],
          testData: { movieId: 1, expectedTitle: 'Interstellar Odyssey' },
          expectedResult: 'Movie Details displays full movie metadata and active Select Showtime CTA.',
          priority: 'P1',
          type: 'positive',
          templateAction: 'movie_details',
        },
      ];
    }

    if (lower.includes('04-showtime')) {
      return [
        {
          id: 'TC-GEN-005',
          scenarioFile,
          title: 'Disable sold-out showtime while allowing available screening selection',
          module: 'Showtime',
          tags: ['@regression'],
          steps: [
            'Sign in and open showtimes for Interstellar Odyssey',
            'Verify sold-out showtime ST-103 button is disabled',
            'Click Choose Seats on available showtime ST-101',
            'Verify 10x10 seat map renders',
          ],
          testData: { movieId: 1, availableShowtimeId: 'ST-101', soldOutShowtimeId: 'ST-103' },
          expectedResult: 'Sold-out showtime is non-selectable and available showtime opens the seat map.',
          priority: 'P0',
          type: 'negative',
          templateAction: 'showtime_soldout_check',
        },
      ];
    }

    if (lower.includes('05-seat-map')) {
      return [
        {
          id: 'TC-GEN-006',
          scenarioFile,
          title: 'Select two available seats and verify dynamic counts and total price',
          module: 'SeatMap',
          tags: ['@smoke', '@regression'],
          steps: [
            'Open seat map for Interstellar Odyssey (ST-101)',
            'Verify initial available count is 86 and booked count is 14',
            'Select seats C1 and C2',
            'Verify selected count is 2, available count is 84, and total price is $28.00',
          ],
          testData: { showtimeId: 'ST-101', seats: ['C1', 'C2'], expectedTotal: '$28.00' },
          expectedResult: 'Seat counters update accurately and total equals 2 × $14.00 = $28.00.',
          priority: 'P0',
          type: 'positive',
          templateAction: 'seat_selection_price',
        },
      ];
    }

    if (lower.includes('06-seat-limit')) {
      return [
        {
          id: 'TC-GEN-007',
          scenarioFile,
          title: 'Prevent selection of pre-booked seats on the 10x10 seat map',
          module: 'SeatMap',
          tags: ['@regression'],
          steps: [
            'Open seat map for ST-101',
            'Inspect pre-booked seat A1',
            'Verify seat A1 is disabled and cannot enter selected state',
          ],
          testData: { showtimeId: 'ST-101', bookedSeat: 'A1' },
          expectedResult: 'Pre-booked seat remains locked in booked state with selected count 0.',
          priority: 'P0',
          type: 'negative',
          templateAction: 'seat_booked_blocked',
        },
        {
          id: 'TC-GEN-008',
          scenarioFile,
          title: 'Enforce maximum 6 seats limit when attempting to select a 7th seat',
          module: 'SeatMap',
          tags: ['@regression'],
          steps: [
            'Open seat map for ST-101',
            'Select 6 available seats: C1, C2, C3, D1, D2, D3',
            'Attempt to click a 7th available seat D4',
            'Verify seat limit error message appears and selected count remains 6',
          ],
          testData: { showtimeId: 'ST-101', seats: ['C1', 'C2', 'C3', 'D1', 'D2', 'D3', 'D4'] },
          expectedResult: '7th seat selection is rejected and max-6 seat error alert is shown.',
          priority: 'P0',
          type: 'boundary',
          templateAction: 'seat_limit_exceeded',
        },
      ];
    }

    if (lower.includes('07-payment')) {
      return [
        {
          id: 'TC-GEN-009',
          scenarioFile,
          title: 'Reject invalid credit card number and CVV on payment checkout',
          module: 'Payment',
          tags: ['@regression'],
          steps: [
            'Select seats E1 and E2 on ST-101 and proceed to payment',
            'Enter invalid card number "1234" and CVV "9"',
            'Click Pay Now',
            'Verify payment error message is displayed and booking is not confirmed',
          ],
          testData: { seats: ['E1', 'E2'], cardNumber: '1234', cvv: '9' },
          expectedResult: 'Payment validation rejects invalid card details and keeps user on checkout.',
          priority: 'P0',
          type: 'negative',
          templateAction: 'payment_invalid_card',
        },
      ];
    }

    if (lower.includes('08-booking-confirmation')) {
      return [
        {
          id: 'TC-GEN-010',
          scenarioFile,
          title: 'End-to-end movie ticket booking displays confirmation reference and total',
          module: 'Confirmation',
          tags: ['@smoke', '@regression'],
          steps: [
            'Sign in as alice@cinebook.com',
            'Choose Interstellar Odyssey and showtime ST-101',
            'Select seats F1 and F2 and proceed to payment',
            'Submit valid mock card details and verify booking confirmation reference CB-* and $28.00 total',
          ],
          testData: { movieId: 1, showtimeId: 'ST-101', seats: ['F1', 'F2'], expectedTotal: '$28.00' },
          expectedResult: 'Confirmation banner and booking reference ID starting with CB- are shown.',
          priority: 'P0',
          type: 'positive',
          templateAction: 'booking_e2e_confirmation',
        },
      ];
    }

    if (lower.includes('09-boundary-max-seats')) {
      return [
        {
          id: 'TC-GEN-011',
          scenarioFile,
          title: 'Boundary test allowing exactly 6 seats with accurate total calculation',
          module: 'SeatMap',
          tags: ['@regression'],
          steps: [
            'Sign in and open Quantum Horizon showtime ST-201 ($12/ticket)',
            'Select exactly 6 seats: G1, G2, G3, G4, G5, G6',
            'Verify selected count is 6, total is $72.00, and Proceed to Payment is enabled',
          ],
          testData: { movieId: 2, showtimeId: 'ST-201', seats: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6'], expectedTotal: '$72.00' },
          expectedResult: 'Upper boundary of 6 seats succeeds with $72.00 total.',
          priority: 'P1',
          type: 'boundary',
          templateAction: 'seat_limit_boundary_6',
        },
      ];
    }

    return [
      {
        id: 'TC-GEN-012',
        scenarioFile,
        title: 'Filter movies by Animation genre and roundtrip movie details navigation',
        module: 'MovieList',
        tags: ['@regression'],
        steps: [
          'Sign in and select Animation from genre filter',
          'Verify Skyward Chronicles is displayed',
          'Open Movie Details and return to catalog via Back to Movies',
        ],
        testData: { genre: 'Animation', expectedTitle: 'Skyward Chronicles', movieId: 6 },
        expectedResult: 'Genre filter isolates Skyward Chronicles and navigation roundtrip succeeds.',
        priority: 'P2',
        type: 'positive',
        templateAction: 'movie_genre_filter',
      },
    ];
  }

  private mockAnalyzeRca(payload: LlmRcaPayload): LlmRcaResult {
    const primary = `${payload.error} ${payload.testTitle}`.toLowerCase();
    const combined = `${payload.testTitle} ${payload.error} ${payload.stack} ${payload.domDiff}`.toLowerCase();

    // Check explicit bug signatures & assertion errors first before falling back to DOM diff context
    if (primary.includes('bug-07') || primary.includes('invalid card') || primary.includes('payment-error') || primary.includes('cvv')) {
      return {
        category: 'app bug',
        rootCause: 'Payment API accepted malformed card number ("1234" / "9999") and CVV without returning validation error (Injected Defect BUG-07: invalid_card_accepted).',
        suggestedFix: 'Enforce 16-digit PAN, MM/YY expiry, and 3-digit CVV regex validation in POST /api/bookings.',
        confidence: 0.97,
        linkedBugId: 'BUG-07',
      };
    }

    if (primary.includes('bug-08') || primary.includes('sold-out') || primary.includes('sold out') || primary.includes('st-103')) {
      return {
        category: 'app bug',
        rootCause: 'Sold-out showtime ST-103 button was rendered enabled instead of disabled (Injected Defect BUG-08: showtime_soldout_selectable).',
        suggestedFix: 'Enforce disabled attribute and server-side guard on showtimes where sold_out === 1 in sut/public/app.js.',
        confidence: 0.96,
        linkedBugId: 'BUG-08',
      };
    }

    if (primary.includes('bug-01') || primary.includes('booked seat') || primary.includes('pre-booked') || primary.includes('seat-a1')) {
      return {
        category: 'app bug',
        rootCause: 'Pre-booked seat button remained interactive and allowed selection instead of staying disabled (Injected Defect BUG-01: booked_seat_selectable).',
        suggestedFix: 'Set disabled attribute on booked seats and reject clicks on originallyBooked seats in renderSeatMap().',
        confidence: 0.97,
        linkedBugId: 'BUG-01',
      };
    }

    if (primary.includes('bug-02') || primary.includes('$28.00') || primary.includes('$72.00') || primary.includes('$43.00') || primary.includes('$87.00') || primary.includes('total price') || primary.includes('total must be')) {
      return {
        category: 'app bug',
        rootCause: 'Calculated ticket total includes an erroneous +$15.00 phantom surcharge (Injected Defect BUG-02: wrong_total_price).',
        suggestedFix: 'Fix computeTotal() in sut/public/app.js and /api/bookings in sut/server.js to multiply selectedSeats.length * ticketPrice without extra fee.',
        confidence: 0.98,
        linkedBugId: 'BUG-02',
      };
    }

    if (primary.includes('bug-03') || primary.includes('seat limit') || primary.includes('maximum 6') || primary.includes('max 6') || primary.includes('7th seat')) {
      return {
        category: 'app bug',
        rootCause: 'Seat map failed to enforce the 6-seat maximum booking constraint and permitted selecting a 7th seat (Injected Defect BUG-03: no_seat_limit_validation).',
        suggestedFix: 'Restore selectedSeats.length >= 6 check in seat click handler and POST /api/bookings validation.',
        confidence: 0.96,
        linkedBugId: 'BUG-03',
      };
    }

    if (primary.includes('bug-04') || primary.includes('confirmation banner') || primary.includes('booking reference') || primary.includes('booking-reference') || primary.includes('cb-')) {
      return {
        category: 'app bug',
        rootCause: 'Booking confirmation page omitted the confirmation banner and CB-* reservation reference ID (Injected Defect BUG-04: missing_confirmation).',
        suggestedFix: 'Return generated bookingRef from POST /api/bookings and always render confirmationBanner & bookingRef in renderConfirmation().',
        confidence: 0.97,
        linkedBugId: 'BUG-04',
      };
    }

    if (primary.includes('bug-05') || primary.includes('login-error') || primary.includes('invalid credentials') || primary.includes('empty login') || primary.includes('invalid or empty login')) {
      return {
        category: 'app bug',
        rootCause: 'Authentication endpoint bypassed credential validation for invalid/empty login input (Injected Defect BUG-05: empty_login_bypass).',
        suggestedFix: 'Reject missing or non-matching credentials in POST /api/auth/login with HTTP 400/401 and display login-error alert.',
        confidence: 0.96,
        linkedBugId: 'BUG-05',
      };
    }

    if (primary.includes('bug-06') || primary.includes('search') || primary.includes('genre filter')) {
      return {
        category: 'app bug',
        rootCause: 'Movie catalog API ignored search query / genre filter and returned all 6 movies unfiltered (Injected Defect BUG-06: broken_movie_search).',
        suggestedFix: 'Apply case-insensitive title and genre filtering in GET /api/movies inside sut/server.js.',
        confidence: 0.96,
        linkedBugId: 'BUG-06',
      };
    }

    if (combined.includes('timeout') || combined.includes('waiting for locator') || combined.includes('strict mode violation')) {
      if (combined.includes('#') || combined.includes('locator')) {
        return {
          category: 'locator change',
          rootCause: 'Target DOM locator could not be resolved before timeout due to UI attribute/selector change.',
          suggestedFix: 'Verify DOM snapshot freshness in reports/dom-snapshots.json and tune FastAPI self-healing similarity threshold.',
          confidence: 0.88,
        };
      }
      return {
        category: 'timing',
        rootCause: 'Asynchronous view transition or network request exceeded the Playwright wait timeout.',
        suggestedFix: 'Await explicit page state selector or API response before performing assertions.',
        confidence: 0.84,
      };
    }

    if (combined.includes('econnrefused') || combined.includes('net::err_connection')) {
      return {
        category: 'environment',
        rootCause: 'Target SUT or AI microservice endpoint was unreachable during execution.',
        suggestedFix: 'Ensure both SUT (port 3100) and FastAPI AI service (port 8100) pass /health checks before starting Playwright.',
        confidence: 0.94,
      };
    }

    return {
      category: 'app bug',
      rootCause: `Assertion failed in ${payload.module} module: ${payload.error.slice(0, 180)}`,
      suggestedFix: 'Inspect failed assertion diff, screenshot, and Playwright trace to remediate application behavior.',
      confidence: 0.82,
    };
  }
}
