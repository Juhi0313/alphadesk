import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'data.json');

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_KEY = 'alphadesk-db';

const defaultData = {
  watchlist: [],
  filings: [],
  contradictions: [],
  notes: [],
  prices: {}
};

async function loadFromRedis() {
  const res = await fetch(`${UPSTASH_URL}/get/${REDIS_KEY}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  const json = await res.json();
  return json.result ? JSON.parse(json.result) : null;
}

function saveToRedis(data) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return;
  fetch(`${UPSTASH_URL}/set/${REDIS_KEY}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ value: JSON.stringify(data) })
  }).catch(e => console.error('[Redis] save error:', e.message));
}

function loadFromFile() {
  try {
    if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (e) {}
  return null;
}

function saveToFile(data) {
  try { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); } catch (e) {}
}

let _db = { ...defaultData };

export async function initDb() {
  try {
    if (UPSTASH_URL && UPSTASH_TOKEN) {
      const data = await loadFromRedis();
      if (data) { _db = data; console.log('[DB] Loaded from Upstash Redis'); return; }
    }
  } catch (e) {
    console.error('[DB] Redis load failed, falling back to file:', e.message);
  }
  const data = loadFromFile();
  if (data) { _db = data; console.log('[DB] Loaded from local file'); }
}

export const db = {
  save: () => {
    saveToRedis(_db);
    saveToFile(_db);
  },

  getWatchlist: () => _db.watchlist,
  addToWatchlist: (item) => {
    if (!_db.watchlist.find(w => w.ticker === item.ticker)) {
      _db.watchlist.push({ ...item, addedAt: Date.now() });
      db.save();
    }
  },
  removeFromWatchlist: (ticker) => {
    _db.watchlist = _db.watchlist.filter(w => w.ticker !== ticker);
    db.save();
  },

  getFilings: (ticker) => ticker
    ? _db.filings.filter(f => f.ticker === ticker)
    : _db.filings,
  addFiling: (filing) => {
    if (!_db.filings.find(f => f.accessionNumber === filing.accessionNumber)) {
      _db.filings.push(filing);
      db.save();
      return true;
    }
    return false;
  },

  getContradictions: (ticker) => ticker
    ? _db.contradictions.filter(c => c.ticker === ticker)
    : _db.contradictions,
  addContradiction: (c) => {
    _db.contradictions.push({ ...c, detectedAt: Date.now() });
    db.save();
  },
  clearContradictions: (ticker) => {
    _db.contradictions = _db.contradictions.filter(c => c.ticker !== ticker);
    db.save();
  },

  getNotes: (ticker) => ticker
    ? _db.notes.filter(n => n.ticker === ticker)
    : _db.notes,
  saveNote: (note) => {
    const idx = _db.notes.findIndex(n => n.id === note.id);
    if (idx >= 0) _db.notes[idx] = note;
    else _db.notes.push(note);
    db.save();
  },

  getPrice: (ticker) => _db.prices[ticker] || null,
  setPrice: (ticker, data) => {
    _db.prices[ticker] = { ...data, updatedAt: Date.now() };
    db.save();
  }
};
