const express = require('express');
const path = require('path');
const { getDb, resetDatabase } = require('./db');

const app = express();
app.use(express.json());

const PORT = Number(process.env.SUT_PORT || 3100);

// Runtime flags (can be set via env vars or POST /api/config or per-page query params)
const runtimeFlags = {
  locatorChange: process.env.LOCATOR_CHANGE === 'true',
  bugInjection: process.env.BUG_INJECTION === 'true',
};

const INJECTED_BUG_CATALOG = [
  { id: 'BUG-01', code: 'booked_seat_selectable', module: 'SeatMap', description: 'Pre-booked seats can be clicked and selected instead of being blocked.' },
  { id: 'BUG-02', code: 'wrong_total_price', module: 'SeatMap', description: 'Total ticket price adds an erroneous $15 phantom surcharge.' },
  { id: 'BUG-03', code: 'no_seat_limit_validation', module: 'SeatMap', description: 'Selecting more than 6 seats is not blocked by max-seat validation.' },
  { id: 'BUG-04', code: 'missing_confirmation', module: 'Confirmation', description: 'Booking confirmation page omits booking reference ID and confirmation banner.' },
  { id: 'BUG-05', code: 'empty_login_bypass', module: 'Login', description: 'Empty or invalid login credentials bypass authentication without error.' },
  { id: 'BUG-06', code: 'broken_movie_search', module: 'MovieList', description: 'Movie search query returns all movies unfiltered.' },
  { id: 'BUG-07', code: 'invalid_card_accepted', module: 'Payment', description: 'Invalid credit card number or CVV is accepted without validation error.' },
  { id: 'BUG-08', code: 'showtime_soldout_selectable', module: 'Showtime', description: 'Sold-out showtime button remains enabled and navigable.' },
];

function isBugActive(req) {
  if (req.query && typeof req.query.bugs === 'string') {
    return req.query.bugs === 'true';
  }
  if (req.headers['x-bug-injection'] !== undefined) {
    return req.headers['x-bug-injection'] === 'true';
  }
  return runtimeFlags.bugInjection;
}

// Serve static SPA assets
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'CineBook Pro SUT',
    locatorChange: runtimeFlags.locatorChange,
    bugInjection: runtimeFlags.bugInjection,
    totalInjectedBugs: INJECTED_BUG_CATALOG.length,
  });
});

app.get('/api/config', (_req, res) => {
  res.json({
    locatorChange: runtimeFlags.locatorChange,
    bugInjection: runtimeFlags.bugInjection,
    bugs: runtimeFlags.bugInjection ? INJECTED_BUG_CATALOG : [],
    bugCatalog: INJECTED_BUG_CATALOG,
  });
});

app.post('/api/config', (req, res) => {
  if (typeof req.body.locatorChange === 'boolean') {
    runtimeFlags.locatorChange = req.body.locatorChange;
  }
  if (typeof req.body.bugInjection === 'boolean') {
    runtimeFlags.bugInjection = req.body.bugInjection;
  }
  res.json({
    locatorChange: runtimeFlags.locatorChange,
    bugInjection: runtimeFlags.bugInjection,
  });
});

app.post('/api/reset', (_req, res) => {
  const result = resetDatabase();
  res.json(result);
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const bugsOn = isBugActive(req);

  // BUG-05: Empty/invalid login bypasses validation
  if (bugsOn) {
    const db = getDb();
    const user = db.prepare('SELECT id, email, name FROM users WHERE email = ? AND password = ?').get(email || '', password || '');
    if (user) {
      return res.json({ success: true, user });
    }
    return res.json({
      success: true,
      user: { id: 999, email: email || 'guest@cinebook.com', name: 'Guest Bypass' },
    });
  }

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  const db = getDb();
  const user = db.prepare('SELECT id, email, name FROM users WHERE email = ? AND password = ?').get(email, password);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid email or password.' });
  }

  return res.json({ success: true, user });
});

app.get('/api/movies', (req, res) => {
  const db = getDb();
  const q = String(req.query.q || '').trim().toLowerCase();
  const genre = String(req.query.genre || '').trim().toLowerCase();
  const bugsOn = isBugActive(req);

  let movies = db.prepare('SELECT * FROM movies ORDER BY id ASC').all();

  // BUG-06: Movie search returns all movies unfiltered
  if (!bugsOn) {
    if (q) {
      movies = movies.filter(
        (m) => m.title.toLowerCase().includes(q) || m.genre.toLowerCase().includes(q)
      );
    }
    if (genre && genre !== 'all') {
      movies = movies.filter((m) => m.genre.toLowerCase() === genre);
    }
  }

  res.json({ movies });
});

app.get('/api/movies/:id', (req, res) => {
  const db = getDb();
  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(Number(req.params.id));
  if (!movie) {
    return res.status(404).json({ error: 'Movie not found.' });
  }
  res.json({ movie });
});

app.get('/api/movies/:id/showtimes', (req, res) => {
  const db = getDb();
  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(Number(req.params.id));
  if (!movie) {
    return res.status(404).json({ error: 'Movie not found.' });
  }
  const showtimes = db
    .prepare(`
      SELECT s.*, t.name as theatre_name, t.location as theatre_location
      FROM showtimes s
      JOIN theatres t ON t.id = s.theatre_id
      WHERE s.movie_id = ?
      ORDER BY s.time ASC
    `)
    .all(Number(req.params.id));

  res.json({ movie, showtimes });
});

app.get('/api/showtimes/:id/seats', (req, res) => {
  const db = getDb();
  const showtime = db
    .prepare(`
      SELECT s.*, m.title as movie_title, m.price as ticket_price, t.name as theatre_name
      FROM showtimes s
      JOIN movies m ON m.id = s.movie_id
      JOIN theatres t ON t.id = s.theatre_id
      WHERE s.id = ?
    `)
    .get(req.params.id);

  if (!showtime) {
    return res.status(404).json({ error: 'Showtime not found.' });
  }

  const seats = db
    .prepare('SELECT seat_label, row_label, col_num, status FROM seats WHERE showtime_id = ? ORDER BY row_label ASC, col_num ASC')
    .all(req.params.id);

  res.json({ showtime, seats });
});

app.post('/api/bookings', (req, res) => {
  const db = getDb();
  const bugsOn = isBugActive(req);
  const { userEmail, showtimeId, seats, cardHolder, cardNumber, expiry, cvv, persistSeats } = req.body || {};

  if (!showtimeId || !Array.isArray(seats) || seats.length === 0) {
    return res.status(400).json({ success: false, error: 'Please select at least one seat.' });
  }

  // Seat limit check (skipped in BUG-03)
  if (!bugsOn && seats.length > 6) {
    return res.status(400).json({ success: false, error: 'Maximum 6 seats allowed per booking.' });
  }

  // Card validation (skipped in BUG-07)
  const cleanCard = String(cardNumber || '').replace(/\s+/g, '');
  const cleanCvv = String(cvv || '').trim();
  if (!bugsOn) {
    if (!cardHolder || String(cardHolder).trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Cardholder name is required.' });
    }
    if (!/^\d{16}$/.test(cleanCard)) {
      return res.status(400).json({ success: false, error: 'Card number must be 16 digits.' });
    }
    if (!/^\d{2}\/\d{2}$/.test(String(expiry || '').trim())) {
      return res.status(400).json({ success: false, error: 'Expiry must be in MM/YY format.' });
    }
    if (!/^\d{3}$/.test(cleanCvv)) {
      return res.status(400).json({ success: false, error: 'CVV must be 3 digits.' });
    }
  }

  const showtime = db
    .prepare(`
      SELECT s.*, m.title as movie_title, m.price as ticket_price, t.name as theatre_name
      FROM showtimes s
      JOIN movies m ON m.id = s.movie_id
      JOIN theatres t ON t.id = s.theatre_id
      WHERE s.id = ?
    `)
    .get(showtimeId);

  if (!showtime) {
    return res.status(404).json({ success: false, error: 'Showtime not found.' });
  }

  // Check if any requested seat is already booked (skipped in BUG-01)
  if (!bugsOn) {
    const checkSeat = db.prepare('SELECT status FROM seats WHERE showtime_id = ? AND seat_label = ?');
    for (const label of seats) {
      const row = checkSeat.get(showtimeId, label);
      if (!row || row.status === 'booked') {
        return res.status(409).json({ success: false, error: `Seat ${label} is already booked.` });
      }
    }
  }

  // Calculate total price (BUG-02 adds erroneous $15 surcharge)
  const baseTotal = seats.length * Number(showtime.ticket_price);
  const totalPrice = bugsOn ? baseTotal + 15 : baseTotal;

  const bookingRef = `CB-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO bookings (booking_ref, user_email, showtime_id, movie_title, theatre_name, show_time, seats_json, total_price, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    bookingRef,
    userEmail || 'alice@cinebook.com',
    showtimeId,
    showtime.movie_title,
    showtime.theatre_name,
    `${showtime.date} ${showtime.time}`,
    JSON.stringify(seats),
    totalPrice,
    'CONFIRMED',
    createdAt
  );

  // Only mutate seat map persistence when explicitly requested (keeps parallel visual tests deterministic)
  if (persistSeats === true) {
    const updateSeat = db.prepare("UPDATE seats SET status = 'booked' WHERE showtime_id = ? AND seat_label = ?");
    for (const label of seats) {
      updateSeat.run(showtimeId, label);
    }
  }

  return res.json({
    success: true,
    booking: {
      bookingRef: bugsOn ? '' : bookingRef, // BUG-04 omits booking ref
      userEmail: userEmail || 'alice@cinebook.com',
      showtimeId,
      movieTitle: showtime.movie_title,
      theatreName: showtime.theatre_name,
      showTime: `${showtime.date} ${showtime.time}`,
      seats,
      totalPrice,
      status: bugsOn ? 'PENDING' : 'CONFIRMED',
      createdAt,
    },
  });
});

app.get('/api/bookings/:ref', (req, res) => {
  const db = getDb();
  const booking = db.prepare('SELECT * FROM bookings WHERE booking_ref = ?').get(req.params.ref);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found.' });
  }
  res.json({ booking });
});

// Serve generated AI Test Intelligence Dashboard & reports
app.get('/dashboard', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'reports', 'dashboard.html'));
});
app.use('/reports', express.static(path.join(__dirname, '..', 'reports')));

// Fallback to index.html for SPA routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize SQLite on startup
getDb();

const server = app.listen(PORT, () => {
  console.log(
    `[SUT] CineBook Pro listening on http://localhost:${PORT} (locatorChange=${runtimeFlags.locatorChange}, bugInjection=${runtimeFlags.bugInjection})`
  );
});
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
