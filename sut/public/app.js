/* CineBook Pro SPA - Demo System Under Test
 * Supports 7 views, Locator-Change Mode (UI refactor simulation), and 8 toggleable bugs.
 */
(function () {
  const params = new URLSearchParams(window.location.search);

  const state = {
    config: {
      locatorChange: false,
      bugInjection: false,
    },
    view: 'login',
    user: null,
    movies: [],
    searchQuery: '',
    genreFilter: 'all',
    selectedMovie: null,
    showtimes: [],
    selectedShowtime: null,
    seats: [],
    selectedSeats: [],
    seatError: '',
    paymentError: '',
    loginError: '',
    booking: null,
  };

  // Maps logical element keys -> normal vs locator-change ("v2") id/testid/class attributes
  const LOCATOR_MAP = {
    loginForm: { id: 'login-form', v2Id: 'auth-panel-form-v2', cls: 'login-form', v2Cls: 'auth-form-v2' },
    loginEmail: { id: 'login-email', v2Id: 'auth-email-field-v2', cls: 'input login-email-input', v2Cls: 'input user-identifier-v2' },
    loginPassword: { id: 'login-password', v2Id: 'auth-secret-field-v2', cls: 'input login-password-input', v2Cls: 'input user-passcode-v2' },
    loginSubmit: { id: 'login-submit', v2Id: 'signin-primary-cta-v2', cls: 'btn btn-primary btn-block login-submit-btn', v2Cls: 'btn btn-primary btn-block auth-submit-v2' },
    loginError: { id: 'login-error', v2Id: 'auth-feedback-banner-v2', cls: 'alert alert-error login-error-msg', v2Cls: 'alert alert-error auth-alert-v2' },

    searchInput: { id: 'search-movies-input', v2Id: 'catalog-query-box-v2', cls: 'input movie-search-input', v2Cls: 'input film-filter-input-v2' },
    genreSelect: { id: 'genre-filter-select', v2Id: 'catalog-category-select-v2', cls: 'select genre-select', v2Cls: 'select film-genre-picker-v2' },
    searchBtn: { id: 'search-movies-btn', v2Id: 'catalog-search-trigger-v2', cls: 'btn btn-primary search-btn', v2Cls: 'btn btn-primary filter-apply-v2' },
    moviesGrid: { id: 'movies-grid', v2Id: 'catalog-cards-container-v2', cls: 'movies-grid', v2Cls: 'movies-grid film-gallery-v2' },

    detailsHeading: { id: 'movie-details-title', v2Id: 'film-overview-heading-v2', cls: 'details-title', v2Cls: 'film-headline-v2' },
    detailsSynopsis: { id: 'movie-details-synopsis', v2Id: 'film-plot-summary-v2', cls: 'details-synopsis', v2Cls: 'film-description-v2' },
    bookShowtimesBtn: { id: 'select-showtime-btn', v2Id: 'choose-screening-cta-v2', cls: 'btn btn-primary btn-block select-showtime-btn', v2Cls: 'btn btn-primary btn-block view-schedule-v2' },
    backToMoviesBtn: { id: 'back-to-movies-btn', v2Id: 'return-catalog-btn-v2', cls: 'btn btn-outline back-movies-btn', v2Cls: 'btn btn-outline catalog-back-v2' },

    showtimeList: { id: 'showtime-list', v2Id: 'screening-schedule-list-v2', cls: 'showtime-list', v2Cls: 'showtime-list schedule-rows-v2' },

    seatGrid: { id: 'seat-grid', v2Id: 'auditorium-matrix-v2', cls: 'seat-grid', v2Cls: 'auditorium-matrix-v2' },
    seatError: { id: 'seat-error', v2Id: 'seat-validation-notice-v2', cls: 'alert alert-error seat-error-msg', v2Cls: 'alert alert-error seat-limit-alert-v2' },
    availableCount: { id: 'count-available', v2Id: 'stat-open-seats-v2', cls: 'stat-value', v2Cls: 'metric-open-v2' },
    selectedCount: { id: 'count-selected', v2Id: 'stat-chosen-seats-v2', cls: 'stat-value', v2Cls: 'metric-chosen-v2' },
    bookedCount: { id: 'count-booked', v2Id: 'stat-reserved-seats-v2', cls: 'stat-value', v2Cls: 'metric-reserved-v2' },
    totalPrice: { id: 'seat-total-price', v2Id: 'order-subtotal-amount-v2', cls: 'total-price-value', v2Cls: 'checkout-sum-v2' },
    proceedPaymentBtn: { id: 'proceed-to-payment-btn', v2Id: 'checkout-continue-action-v2', cls: 'btn btn-primary btn-block proceed-payment-btn', v2Cls: 'btn btn-primary btn-block seat-next-step-v2' },

    cardHolder: { id: 'card-holder-input', v2Id: 'billing-name-field-v2', cls: 'input card-holder-input', v2Cls: 'input payer-name-v2' },
    cardNumber: { id: 'card-number-input', v2Id: 'billing-pan-field-v2', cls: 'input card-number-input', v2Cls: 'input payer-card-v2' },
    cardExpiry: { id: 'card-expiry-input', v2Id: 'billing-exp-field-v2', cls: 'input card-expiry-input', v2Cls: 'input payer-expiry-v2' },
    cardCvv: { id: 'card-cvv-input', v2Id: 'billing-cvc-field-v2', cls: 'input card-cvv-input', v2Cls: 'input payer-cvv-v2' },
    paymentError: { id: 'payment-error', v2Id: 'billing-error-notice-v2', cls: 'alert alert-error payment-error-msg', v2Cls: 'alert alert-error checkout-alert-v2' },
    paymentTotal: { id: 'payment-total-amount', v2Id: 'billing-grand-total-v2', cls: 'payment-total-value', v2Cls: 'checkout-due-v2' },
    payNowBtn: { id: 'pay-now-btn', v2Id: 'complete-purchase-cta-v2', cls: 'btn btn-success btn-block pay-now-btn', v2Cls: 'btn btn-success btn-block submit-payment-v2' },

    confirmationBanner: { id: 'confirmation-banner', v2Id: 'ticket-confirmed-badge-v2', cls: 'alert alert-success confirmation-banner', v2Cls: 'alert alert-success receipt-status-v2' },
    bookingRef: { id: 'booking-reference', v2Id: 'reservation-code-v2', cls: 'confirmation-ref', v2Cls: 'confirmation-ref receipt-code-v2' },
    confirmationTotal: { id: 'confirmation-total', v2Id: 'receipt-paid-amount-v2', cls: 'confirmation-total-value', v2Cls: 'receipt-total-v2' },
    bookAnotherBtn: { id: 'book-another-btn', v2Id: 'new-reservation-cta-v2', cls: 'btn btn-primary book-another-btn', v2Cls: 'btn btn-primary return-home-v2' },
  };

  function loc(key) {
    const entry = LOCATOR_MAP[key];
    const v2 = state.config.locatorChange;
    return {
      id: v2 ? entry.v2Id : entry.id,
      testid: v2 ? entry.v2Id : entry.id,
      cls: v2 ? entry.v2Cls : entry.cls,
    };
  }

  function attrs(key) {
    const l = loc(key);
    return `id="${l.id}" data-testid="${l.testid}" class="${l.cls}"`;
  }

  function apiHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-bug-injection': String(state.config.bugInjection),
    };
  }

  function computeTotal(count, unitPrice) {
    const base = count * Number(unitPrice || 0);
    // BUG-02: Adds erroneous $15 phantom fee when bugInjection is true
    if (state.config.bugInjection && count > 0) {
      return base + 15;
    }
    return base;
  }

  async function init() {
    try {
      const res = await fetch('/api/config');
      const cfg = await res.json();
      state.config.locatorChange = Boolean(cfg.locatorChange);
      state.config.bugInjection = Boolean(cfg.bugInjection);
    } catch (_err) {
      // Fallback to defaults if config call fails
    }

    if (params.has('locatorChange')) {
      state.config.locatorChange = params.get('locatorChange') === 'true';
    }
    if (params.has('bugs')) {
      state.config.bugInjection = params.get('bugs') === 'true';
    }

    window.__CINEBOOK_CONFIG__ = state.config;
    renderHeader();

    document.getElementById('nav-movies-btn').addEventListener('click', () => loadMovies());
    document.getElementById('nav-logout-btn').addEventListener('click', () => {
      state.user = null;
      state.view = 'login';
      renderHeader();
      render();
    });

    render();
  }

  function renderHeader() {
    const badgesEl = document.getElementById('mode-badges');
    const badges = [];
    if (state.config.locatorChange) {
      badges.push('<span class="badge badge-warn">Locator-Change Mode</span>');
    }
    if (state.config.bugInjection) {
      badges.push('<span class="badge badge-danger">Bug-Injection Mode (8 Bugs)</span>');
    }
    badgesEl.innerHTML = badges.join('');

    const greeting = document.getElementById('user-greeting');
    const navMovies = document.getElementById('nav-movies-btn');
    const navLogout = document.getElementById('nav-logout-btn');

    if (state.user) {
      greeting.textContent = `Signed in as ${state.user.name}`;
      greeting.classList.remove('hidden');
      navMovies.classList.remove('hidden');
      navLogout.classList.remove('hidden');
    } else {
      greeting.classList.add('hidden');
      navMovies.classList.add('hidden');
      navLogout.classList.add('hidden');
    }
  }

  async function loadMovies(query = '', genre = 'all') {
    state.searchQuery = query;
    state.genreFilter = genre;
    const qs = new URLSearchParams();
    if (query) qs.set('q', query);
    if (genre && genre !== 'all') qs.set('genre', genre);
    qs.set('bugs', String(state.config.bugInjection));

    const res = await fetch(`/api/movies?${qs.toString()}`);
    const data = await res.json();
    state.movies = data.movies || [];
    state.view = 'movies';
    render();
  }

  async function loadMovieDetails(movieId) {
    const res = await fetch(`/api/movies/${movieId}`);
    const data = await res.json();
    state.selectedMovie = data.movie;
    state.view = 'movie-details';
    render();
  }

  async function loadShowtimes(movieId) {
    const res = await fetch(`/api/movies/${movieId}/showtimes`);
    const data = await res.json();
    state.selectedMovie = data.movie;
    state.showtimes = data.showtimes || [];
    state.view = 'showtimes';
    render();
  }

  async function loadSeatMap(showtimeId) {
    const res = await fetch(`/api/showtimes/${showtimeId}/seats`);
    const data = await res.json();
    state.selectedShowtime = data.showtime;
    state.seats = data.seats || [];
    state.selectedSeats = [];
    state.seatError = '';
    state.view = 'seats';
    render();
  }

  function render() {
    const root = document.getElementById('app-root');
    if (state.view === 'login') return renderLogin(root);
    if (state.view === 'movies') return renderMovies(root);
    if (state.view === 'movie-details') return renderMovieDetails(root);
    if (state.view === 'showtimes') return renderShowtimes(root);
    if (state.view === 'seats') return renderSeatMap(root);
    if (state.view === 'payment') return renderPayment(root);
    if (state.view === 'confirmation') return renderConfirmation(root);
  }

  function renderLogin(root) {
    root.innerHTML = `
      <section class="auth-wrapper card" data-page="login">
        <h1>Sign In to CineBook Pro</h1>
        <p class="subtitle">Book IMAX, Dolby Atmos, and standard movie tickets effortlessly.</p>
        ${state.loginError ? `<div ${attrs('loginError')} role="alert">${state.loginError}</div>` : ''}
        <form ${attrs('loginForm')} novalidate>
          <div class="form-group">
            <label for="${loc('loginEmail').id}">Email Address</label>
            <input ${attrs('loginEmail')} type="email" name="email" placeholder="alice@cinebook.com" aria-label="Email Address" autocomplete="username" />
          </div>
          <div class="form-group">
            <label for="${loc('loginPassword').id}">Password</label>
            <input ${attrs('loginPassword')} type="password" name="password" placeholder="Enter your password" aria-label="Password" autocomplete="current-password" />
          </div>
          <button ${attrs('loginSubmit')} type="submit" aria-label="Sign In">Sign In</button>
        </form>
        <p class="subtitle" style="margin-top:16px;margin-bottom:0;">Demo account: <strong>alice@cinebook.com</strong> / <strong>Cinema@123</strong></p>
      </section>
    `;

    document.getElementById(loc('loginForm').id).addEventListener('submit', async (e) => {
      e.preventDefault();
      state.loginError = '';
      const email = document.getElementById(loc('loginEmail').id).value.trim();
      const password = document.getElementById(loc('loginPassword').id).value;

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        state.loginError = data.error || 'Authentication failed.';
        render();
        return;
      }

      state.user = data.user;
      renderHeader();
      await loadMovies();
    });
  }

  function renderMovies(root) {
    const v2 = state.config.locatorChange;
    const cardCls = v2 ? 'film-tile-v2' : 'movie-card';

    const cardsHtml = state.movies.length
      ? state.movies
          .map((m) => {
            const viewId = v2 ? `inspect-film-${m.id}-v2` : `view-movie-${m.id}`;
            const viewCls = v2 ? 'btn btn-primary open-film-details-v2' : 'btn btn-primary view-details-btn';
            return `
              <article class="${cardCls}" data-movie-id="${m.id}" data-movie-title="${m.title}">
                <div class="movie-poster" style="background: linear-gradient(135deg, ${m.accent}, #0f172a);">
                  <span class="badge badge-info">${m.genre}</span>
                  <span class="badge badge-warn">★ ${m.score}</span>
                </div>
                <div class="movie-body">
                  <h2 class="movie-title">${m.title}</h2>
                  <p class="movie-meta">${m.duration} &bull; Rated ${m.rating}</p>
                  <p class="movie-price">$${Number(m.price).toFixed(2)} / ticket</p>
                  <button id="${viewId}" data-testid="${viewId}" class="${viewCls}" type="button" data-action="view-details" data-movie-id="${m.id}" aria-label="View Details for ${m.title}">
                    View Details
                  </button>
                </div>
              </article>
            `;
          })
          .join('')
      : '<div class="card"><p>No movies matched your search criteria.</p></div>';

    root.innerHTML = `
      <section data-page="movies">
        <div class="page-header">
          <div>
            <h1>Now Showing</h1>
            <p class="subtitle" style="margin-bottom:0;">Choose a movie to inspect details, theatres, and real-time seat availability.</p>
          </div>
          <div class="search-bar">
            <input ${attrs('searchInput')} type="search" value="${state.searchQuery}" placeholder="Search movies by title..." aria-label="Search movies" />
            <select ${attrs('genreSelect')} aria-label="Filter by genre">
              <option value="all" ${state.genreFilter === 'all' ? 'selected' : ''}>All Genres</option>
              <option value="Sci-Fi" ${state.genreFilter === 'Sci-Fi' ? 'selected' : ''}>Sci-Fi</option>
              <option value="Thriller" ${state.genreFilter === 'Thriller' ? 'selected' : ''}>Thriller</option>
              <option value="Action" ${state.genreFilter === 'Action' ? 'selected' : ''}>Action</option>
              <option value="Drama" ${state.genreFilter === 'Drama' ? 'selected' : ''}>Drama</option>
              <option value="Mystery" ${state.genreFilter === 'Mystery' ? 'selected' : ''}>Mystery</option>
              <option value="Animation" ${state.genreFilter === 'Animation' ? 'selected' : ''}>Animation</option>
            </select>
            <button ${attrs('searchBtn')} type="button" aria-label="Search Movies">Search</button>
          </div>
        </div>
        <div ${attrs('moviesGrid')}>${cardsHtml}</div>
      </section>
    `;

    const doSearch = () => {
      const q = document.getElementById(loc('searchInput').id).value;
      const g = document.getElementById(loc('genreSelect').id).value;
      loadMovies(q, g);
    };

    document.getElementById(loc('searchBtn').id).addEventListener('click', doSearch);
    document.getElementById(loc('genreSelect').id).addEventListener('change', doSearch);
    document.getElementById(loc('searchInput').id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSearch();
    });

    root.querySelectorAll('[data-action="view-details"]').forEach((btn) => {
      btn.addEventListener('click', () => loadMovieDetails(Number(btn.dataset.movieId)));
    });
  }

  function renderMovieDetails(root) {
    const m = state.selectedMovie;
    root.innerHTML = `
      <section data-page="movie-details">
        <div class="page-header">
          <button ${attrs('backToMoviesBtn')} type="button" aria-label="Back to Movies">← Back to Movies</button>
        </div>
        <div class="details-layout">
          <div class="card">
            <span class="badge badge-info">${m.genre}</span>
            <h1 ${attrs('detailsHeading')} aria-label="Movie Details Title" style="margin-top:10px;">${m.title}</h1>
            <p class="movie-meta" style="margin:8px 0 18px;">${m.duration} &bull; Rated ${m.rating} &bull; IMDb ★ ${m.score}</p>
            <p ${attrs('detailsSynopsis')} aria-label="Movie Synopsis" style="line-height:1.65;margin-bottom:20px;">${m.synopsis}</p>
            <div class="summary-row"><span>Director</span><strong>${m.director}</strong></div>
            <div class="summary-row"><span>Cast</span><strong>${m.cast_members}</strong></div>
          </div>
          <div class="card">
            <h2>Ticket Information</h2>
            <p class="subtitle">Standard &amp; IMAX screenings available today.</p>
            <div class="summary-row"><span>Ticket Price</span><strong>$${Number(m.price).toFixed(2)}</strong></div>
            <div class="summary-row"><span>Max Seats / Order</span><strong>6 seats</strong></div>
            <div style="margin-top:20px;">
              <button ${attrs('bookShowtimesBtn')} type="button" aria-label="Select Showtime">
                Select Showtime
              </button>
            </div>
          </div>
        </div>
      </section>
    `;

    document.getElementById(loc('backToMoviesBtn').id).addEventListener('click', () => loadMovies(state.searchQuery, state.genreFilter));
    document.getElementById(loc('bookShowtimesBtn').id).addEventListener('click', () => loadShowtimes(m.id));
  }

  function renderShowtimes(root) {
    const m = state.selectedMovie;
    const v2 = state.config.locatorChange;
    const rowCls = v2 ? 'screening-row-v2' : 'showtime-card';

    const items = state.showtimes
      .map((st) => {
        const isSoldOut = Number(st.sold_out) === 1;
        // BUG-08: Sold-out showtime remains enabled when bugInjection is true
        const disabledAttr = isSoldOut && !state.config.bugInjection ? 'disabled' : '';
        const btnId = v2 ? `pick-screening-${st.id}-v2` : `select-showtime-${st.id}`;
        const btnCls = v2 ? 'btn btn-primary screening-select-v2' : 'btn btn-primary showtime-select-btn';
        const labelText = isSoldOut ? 'Sold Out' : 'Choose Seats';

        return `
          <div class="${rowCls}" data-showtime-id="${st.id}" data-sold-out="${isSoldOut}">
            <div>
              <h3>${st.theatre_name}</h3>
              <p class="movie-meta">${st.theatre_location} &bull; ${st.screen} &bull; ${st.format}</p>
              <p style="margin-top:6px;"><strong>${st.date}</strong> at <strong>${st.time}</strong></p>
            </div>
            <button id="${btnId}" data-testid="${btnId}" class="${btnCls}" type="button" data-showtime-id="${st.id}" data-sold-out="${isSoldOut}" aria-label="${labelText} for ${st.theatre_name} ${st.time}" ${disabledAttr}>
              ${labelText}
            </button>
          </div>
        `;
      })
      .join('');

    root.innerHTML = `
      <section data-page="showtimes">
        <div class="page-header">
          <div>
            <h1>Select Showtime &amp; Theatre</h1>
            <p class="subtitle" style="margin-bottom:0;">${m.title} &bull; $${Number(m.price).toFixed(2)} per ticket</p>
          </div>
          <button ${attrs('backToMoviesBtn')} type="button" aria-label="Back to Movies">← Back to Movies</button>
        </div>
        <div ${attrs('showtimeList')}>${items}</div>
      </section>
    `;

    document.getElementById(loc('backToMoviesBtn').id).addEventListener('click', () => loadMovies(state.searchQuery, state.genreFilter));
    root.querySelectorAll('button[data-showtime-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        loadSeatMap(btn.dataset.showtimeId);
      });
    });
  }

  function renderSeatMap(root) {
    const st = state.selectedShowtime;
    const v2 = state.config.locatorChange;
    const seatCls = v2 ? 'auditorium-cell-v2' : 'seat-btn';

    const selectedSet = new Set(state.selectedSeats);
    let availableCnt = 0;
    let bookedCnt = 0;
    let selectedCnt = 0;

    const buttonsHtml = state.seats
      .map((s) => {
        let visualStatus = s.status;
        if (selectedSet.has(s.seat_label)) {
          visualStatus = 'selected';
          selectedCnt++;
        } else if (s.status === 'booked') {
          bookedCnt++;
        } else {
          availableCnt++;
        }

        const seatId = v2 ? `grid-cell-${s.seat_label}-v2` : `seat-${s.seat_label}`;
        // BUG-01: Do not disable booked seats in bugInjection mode
        const disabledAttr = s.status === 'booked' && !state.config.bugInjection ? 'disabled' : '';

        return `
          <button
            id="${seatId}"
            data-testid="${seatId}"
            class="${seatCls}"
            type="button"
            data-seat="${s.seat_label}"
            data-status="${visualStatus}"
            data-originally-booked="${s.status === 'booked'}"
            aria-label="Seat ${s.seat_label} ${visualStatus}"
            ${disabledAttr}
          >${s.seat_label}</button>
        `;
      })
      .join('');

    const total = computeTotal(selectedCnt, st.ticket_price);

    root.innerHTML = `
      <section data-page="seats">
        <div class="page-header">
          <div>
            <h1>Select Your Seats (10×10 Auditorium)</h1>
            <p class="subtitle" style="margin-bottom:0;">${st.movie_title} &bull; ${st.theatre_name} &bull; ${st.date} ${st.time}</p>
          </div>
        </div>

        <div class="seat-map-layout">
          <div class="auditorium-panel">
            <div class="screen-banner">CINEMA SCREEN</div>
            <div class="seat-legend">
              <span class="legend-item"><span class="legend-swatch swatch-available"></span> Available</span>
              <span class="legend-item"><span class="legend-swatch swatch-selected"></span> Selected</span>
              <span class="legend-item"><span class="legend-swatch swatch-booked"></span> Booked</span>
            </div>
            ${state.seatError ? `<div ${attrs('seatError')} role="alert">${state.seatError}</div>` : ''}
            <div ${attrs('seatGrid')} role="grid" aria-label="10 by 10 Seat Map">
              ${buttonsHtml}
            </div>
          </div>

          <aside class="card">
            <h2>Booking Summary</h2>
            <div class="summary-row"><span>Available Seats</span><strong ${attrs('availableCount')} aria-label="Available Seats Count">${availableCnt}</strong></div>
            <div class="summary-row"><span>Selected Seats</span><strong ${attrs('selectedCount')} aria-label="Selected Seats Count">${selectedCnt}</strong></div>
            <div class="summary-row"><span>Booked Seats</span><strong ${attrs('bookedCount')} aria-label="Booked Seats Count">${bookedCnt}</strong></div>
            <div class="summary-row"><span>Seat Labels</span><strong id="selected-seat-labels">${state.selectedSeats.join(', ') || 'None'}</strong></div>
            <div class="summary-row"><span>Price / Ticket</span><strong>$${Number(st.ticket_price).toFixed(2)}</strong></div>
            <div class="summary-row total"><span>Total Price</span><strong ${attrs('totalPrice')} aria-label="Total Ticket Price">$${total.toFixed(2)}</strong></div>
            <div style="margin-top:20px;">
              <button ${attrs('proceedPaymentBtn')} type="button" aria-label="Proceed to Payment" ${selectedCnt === 0 ? 'disabled' : ''}>
                Proceed to Payment
              </button>
            </div>
          </aside>
        </div>
      </section>
    `;

    root.querySelectorAll('button[data-seat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const label = btn.dataset.seat;
        const originallyBooked = btn.dataset.originallyBooked === 'true';

        // BUG-01: Booked seats become selectable when bugInjection is enabled
        if (originallyBooked && !state.config.bugInjection) {
          state.seatError = `Seat ${label} is already booked and cannot be selected.`;
          render();
          return;
        }

        state.seatError = '';
        const idx = state.selectedSeats.indexOf(label);
        if (idx >= 0) {
          state.selectedSeats.splice(idx, 1);
        } else {
          // BUG-03: Max 6 seat limit validation skipped when bugInjection is enabled
          if (!state.config.bugInjection && state.selectedSeats.length >= 6) {
            state.seatError = 'Maximum 6 seats allowed per booking.';
            render();
            return;
          }
          state.selectedSeats.push(label);
        }
        render();
      });
    });

    document.getElementById(loc('proceedPaymentBtn').id).addEventListener('click', () => {
      if (state.selectedSeats.length === 0) return;
      state.paymentError = '';
      state.view = 'payment';
      render();
    });
  }

  function renderPayment(root) {
    const st = state.selectedShowtime;
    const total = computeTotal(state.selectedSeats.length, st.ticket_price);

    root.innerHTML = `
      <section data-page="payment">
        <div class="page-header">
          <div>
            <h1>Mock Payment Checkout</h1>
            <p class="subtitle" style="margin-bottom:0;">Enter mock card details to confirm your movie ticket reservation.</p>
          </div>
        </div>
        <div class="payment-grid">
          <div class="card">
            <h2>Card Details</h2>
            ${state.paymentError ? `<div ${attrs('paymentError')} role="alert">${state.paymentError}</div>` : ''}
            <form id="payment-form" novalidate>
              <div class="form-group">
                <label for="${loc('cardHolder').id}">Cardholder Name</label>
                <input ${attrs('cardHolder')} type="text" name="cardHolder" placeholder="Alice Johnson" aria-label="Cardholder Name" />
              </div>
              <div class="form-group">
                <label for="${loc('cardNumber').id}">Card Number (16 digits)</label>
                <input ${attrs('cardNumber')} type="text" name="cardNumber" placeholder="4111111111111111" aria-label="Card Number" />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="${loc('cardExpiry').id}">Expiry (MM/YY)</label>
                  <input ${attrs('cardExpiry')} type="text" name="expiry" placeholder="12/28" aria-label="Expiry Date" />
                </div>
                <div class="form-group">
                  <label for="${loc('cardCvv').id}">CVV (3 digits)</label>
                  <input ${attrs('cardCvv')} type="password" name="cvv" placeholder="123" aria-label="CVV" />
                </div>
              </div>
              <button ${attrs('payNowBtn')} type="submit" aria-label="Pay Now">Pay Now ($${total.toFixed(2)})</button>
            </form>
          </div>

          <aside class="card">
            <h2>Order Summary</h2>
            <div class="summary-row"><span>Movie</span><strong>${st.movie_title}</strong></div>
            <div class="summary-row"><span>Theatre</span><strong>${st.theatre_name}</strong></div>
            <div class="summary-row"><span>Showtime</span><strong>${st.date} ${st.time}</strong></div>
            <div class="summary-row"><span>Seats (${state.selectedSeats.length})</span><strong>${state.selectedSeats.join(', ')}</strong></div>
            <div class="summary-row total"><span>Amount Due</span><strong ${attrs('paymentTotal')} aria-label="Payment Amount Due">$${total.toFixed(2)}</strong></div>
          </aside>
        </div>
      </section>
    `;

    document.getElementById('payment-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      state.paymentError = '';

      const cardHolder = document.getElementById(loc('cardHolder').id).value.trim();
      const cardNumber = document.getElementById(loc('cardNumber').id).value.trim();
      const expiry = document.getElementById(loc('cardExpiry').id).value.trim();
      const cvv = document.getElementById(loc('cardCvv').id).value.trim();

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          userEmail: state.user ? state.user.email : 'alice@cinebook.com',
          showtimeId: st.id,
          seats: state.selectedSeats,
          cardHolder,
          cardNumber,
          expiry,
          cvv,
          persistSeats: false,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        state.paymentError = data.error || 'Payment declined.';
        render();
        return;
      }

      state.booking = data.booking;
      state.view = 'confirmation';
      render();
    });
  }

  function renderConfirmation(root) {
    const b = state.booking;
    // BUG-04: Missing confirmation banner and booking reference when bugInjection is true
    const showConfirmationDetails = !state.config.bugInjection && b && b.bookingRef;

    root.innerHTML = `
      <section class="confirmation-box card" data-page="confirmation">
        ${
          showConfirmationDetails
            ? `
              <div ${attrs('confirmationBanner')} role="status">Booking Confirmed! Your e-tickets are ready.</div>
              <h1>Thank You for Booking</h1>
              <p class="subtitle">Present this booking reference at the cinema kiosk.</p>
              <div ${attrs('bookingRef')} role="status" aria-label="Booking Reference">${b.bookingRef}</div>
            `
            : `
              <h1>Booking Processed</h1>
              <p class="subtitle">Reservation status unavailable.</p>
            `
        }
        <div class="summary-row"><span>Movie</span><strong>${b.movieTitle}</strong></div>
        <div class="summary-row"><span>Theatre</span><strong>${b.theatreName}</strong></div>
        <div class="summary-row"><span>Showtime</span><strong>${b.showTime}</strong></div>
        <div class="summary-row"><span>Seats</span><strong>${b.seats.join(', ')}</strong></div>
        <div class="summary-row total"><span>Total Paid</span><strong ${attrs('confirmationTotal')} aria-label="Confirmation Total Paid">$${Number(b.totalPrice).toFixed(2)}</strong></div>
        <div style="margin-top:24px;">
          <button ${attrs('bookAnotherBtn')} type="button" aria-label="Book Another Movie">Book Another Movie</button>
        </div>
      </section>
    `;

    document.getElementById(loc('bookAnotherBtn').id).addEventListener('click', () => loadMovies());
  }

  init();
})();
