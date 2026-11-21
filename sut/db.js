const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, 'cinema.db');

const MOVIES = [
  {
    id: 1,
    title: 'Interstellar Odyssey',
    genre: 'Sci-Fi',
    duration: '148 min',
    rating: 'PG-13',
    score: '9.1',
    price: 14,
    director: 'Elena Vance',
    cast: 'Marcus Cole, Aria Lin, David Sterling',
    synopsis: 'A deep-space research crew crosses an unstable wormhole to locate a habitable world before Earth faces atmospheric collapse.',
    accent: '#2563eb',
  },
  {
    id: 2,
    title: 'Quantum Horizon',
    genre: 'Thriller',
    duration: '126 min',
    rating: 'PG-13',
    score: '8.7',
    price: 12,
    director: 'Kenji Sato',
    cast: 'Maya Patel, Liam Cross, Nora Brooks',
    synopsis: 'A cryptographic analyst uncovers a time-shifted broadcast predicting major cyber incidents forty-eight hours before they occur.',
    accent: '#7c3aed',
  },
  {
    id: 3,
    title: 'Neon Drift',
    genre: 'Action',
    duration: '119 min',
    rating: 'R',
    score: '8.4',
    price: 15,
    director: 'Sofia Reyes',
    cast: 'Devon Blake, Chloe Kim, Victor Hale',
    synopsis: 'An underground courier races across a rain-soaked cyberpunk metropolis to deliver an encrypted memory core before sunrise.',
    accent: '#db2777',
  },
  {
    id: 4,
    title: 'The Last Symphony',
    genre: 'Drama',
    duration: '134 min',
    rating: 'PG',
    score: '8.9',
    price: 11,
    director: 'Arthur Pendelton',
    cast: 'Clara Evans, Julian Ward, Simone Laurent',
    synopsis: 'A retiring orchestra conductor reunites estranged prodigies for one final performance at Vienna Grand Hall.',
    accent: '#d97706',
  },
  {
    id: 5,
    title: 'Crimson Harbor',
    genre: 'Mystery',
    duration: '122 min',
    rating: 'PG-13',
    score: '8.2',
    price: 13,
    director: 'Hannah Lindqvist',
    cast: 'Owen Mercer, Tessa Reed, Gabriel Cruz',
    synopsis: 'When a lighthouse keeper vanishes during a winter storm, a coastal detective unravels a decades-old maritime secret.',
    accent: '#dc2626',
  },
  {
    id: 6,
    title: 'Skyward Chronicles',
    genre: 'Animation',
    duration: '105 min',
    rating: 'G',
    score: '8.8',
    price: 10,
    director: 'Mei-Ling Zhou',
    cast: 'Leo Park, Zoe Harper, Samira Khan',
    synopsis: 'Two young cloud-ship navigators chart an uncharted archipelago floating high above the storm belt.',
    accent: '#059669',
  },
];

const THEATRES = [
  { id: 1, name: 'CineMax IMAX Downtown', location: '420 Grand Ave, Downtown' },
  { id: 2, name: 'StarLight Multiplex Mall', location: '88 Westgate Plaza' },
  { id: 3, name: 'Grand Royale Cinema', location: '15 Heritage Boulevard' },
];

const SHOWTIMES = [
  { id: 'ST-101', movie_id: 1, theatre_id: 1, time: '14:30', date: '2026-11-20', screen: 'IMAX Screen 1', format: 'IMAX 3D', sold_out: 0 },
  { id: 'ST-102', movie_id: 1, theatre_id: 2, time: '18:00', date: '2026-11-20', screen: 'Screen 4', format: 'Dolby Atmos', sold_out: 0 },
  { id: 'ST-103', movie_id: 1, theatre_id: 3, time: '21:15', date: '2026-11-20', screen: 'Royal Hall', format: 'Standard', sold_out: 1 },
  { id: 'ST-201', movie_id: 2, theatre_id: 1, time: '15:00', date: '2026-11-20', screen: 'Screen 2', format: 'Dolby Atmos', sold_out: 0 },
  { id: 'ST-202', movie_id: 2, theatre_id: 2, time: '19:30', date: '2026-11-20', screen: 'Screen 5', format: 'Standard', sold_out: 0 },
  { id: 'ST-301', movie_id: 3, theatre_id: 1, time: '16:45', date: '2026-11-20', screen: 'IMAX Screen 1', format: 'IMAX 2D', sold_out: 0 },
  { id: 'ST-302', movie_id: 3, theatre_id: 3, time: '20:30', date: '2026-11-20', screen: 'Screen 3', format: 'Standard', sold_out: 0 },
  { id: 'ST-401', movie_id: 4, theatre_id: 3, time: '17:15', date: '2026-11-20', screen: 'Royal Hall', format: 'Standard', sold_out: 0 },
  { id: 'ST-501', movie_id: 5, theatre_id: 2, time: '18:45', date: '2026-11-20', screen: 'Screen 6', format: 'Dolby Atmos', sold_out: 0 },
  { id: 'ST-601', movie_id: 6, theatre_id: 2, time: '13:00', date: '2026-11-20', screen: 'Family Screen', format: '2D', sold_out: 0 },
];

// Deterministic pre-booked seats (14 out of 100) for reproducible visual & DOM assertions
const DEFAULT_BOOKED_SEATS = new Set([
  'A1', 'A2', 'A3',
  'B5', 'B6',
  'C4', 'C5',
  'D7', 'D8',
  'E5', 'E6',
  'F3',
  'G8',
  'H2',
]);

const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    initSchema(db);
  }
  return db;
}

function initSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS movies (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      genre TEXT NOT NULL,
      duration TEXT NOT NULL,
      rating TEXT NOT NULL,
      score TEXT NOT NULL,
      price REAL NOT NULL,
      director TEXT NOT NULL,
      cast_members TEXT NOT NULL,
      synopsis TEXT NOT NULL,
      accent TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS theatres (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS showtimes (
      id TEXT PRIMARY KEY,
      movie_id INTEGER NOT NULL,
      theatre_id INTEGER NOT NULL,
      time TEXT NOT NULL,
      date TEXT NOT NULL,
      screen TEXT NOT NULL,
      format TEXT NOT NULL,
      sold_out INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS seats (
      showtime_id TEXT NOT NULL,
      seat_label TEXT NOT NULL,
      row_label TEXT NOT NULL,
      col_num INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      PRIMARY KEY (showtime_id, seat_label)
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_ref TEXT UNIQUE NOT NULL,
      user_email TEXT NOT NULL,
      showtime_id TEXT NOT NULL,
      movie_title TEXT NOT NULL,
      theatre_name TEXT NOT NULL,
      show_time TEXT NOT NULL,
      seats_json TEXT NOT NULL,
      total_price REAL NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const countRow = database.prepare('SELECT COUNT(*) as cnt FROM movies').get();
  if (!countRow || countRow.cnt === 0) {
    seedData(database);
  }
}

function seedData(database) {
  database.exec('DELETE FROM bookings; DELETE FROM seats; DELETE FROM showtimes; DELETE FROM theatres; DELETE FROM movies; DELETE FROM users;');

  const insertUser = database.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)');
  insertUser.run('alice@cinebook.com', 'Cinema@123', 'Alice Johnson');
  insertUser.run('bob@cinebook.com', 'Movie@456', 'Bob Martinez');

  const insertMovie = database.prepare(
    'INSERT INTO movies (id, title, genre, duration, rating, score, price, director, cast_members, synopsis, accent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const m of MOVIES) {
    insertMovie.run(m.id, m.title, m.genre, m.duration, m.rating, m.score, m.price, m.director, m.cast, m.synopsis, m.accent);
  }

  const insertTheatre = database.prepare('INSERT INTO theatres (id, name, location) VALUES (?, ?, ?)');
  for (const t of THEATRES) {
    insertTheatre.run(t.id, t.name, t.location);
  }

  const insertShowtime = database.prepare(
    'INSERT INTO showtimes (id, movie_id, theatre_id, time, date, screen, format, sold_out) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  for (const st of SHOWTIMES) {
    insertShowtime.run(st.id, st.movie_id, st.theatre_id, st.time, st.date, st.screen, st.format, st.sold_out);
  }

  const insertSeat = database.prepare(
    'INSERT INTO seats (showtime_id, seat_label, row_label, col_num, status) VALUES (?, ?, ?, ?, ?)'
  );
  for (const st of SHOWTIMES) {
    for (const row of ROWS) {
      for (let col = 1; col <= 10; col++) {
        const label = `${row}${col}`;
        const status = st.sold_out === 1 || DEFAULT_BOOKED_SEATS.has(label) ? 'booked' : 'available';
        insertSeat.run(st.id, label, row, col, status);
      }
    }
  }
}

function resetDatabase() {
  const database = getDb();
  seedData(database);
  return { ok: true, movies: MOVIES.length, showtimes: SHOWTIMES.length, seatsPerShowtime: 100 };
}

module.exports = {
  getDb,
  resetDatabase,
  DEFAULT_BOOKED_SEATS: Array.from(DEFAULT_BOOKED_SEATS),
};
