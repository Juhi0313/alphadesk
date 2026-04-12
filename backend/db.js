// Simple JSON-based persistent storage (no native dependencies)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'data.json');

const defaultData = {
  watchlist: [],
  filings: [],
  contradictions: [],
  notes: [],
  prices: {}
};

function load() {
  try {
    if (fs.existsSync(DB_PATH)) {
      return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    }
  } catch (e) {}
  return { ...defaultData };
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

let _db = load();

export const db = {
  get: () => _db,
  save: () => save(_db),
  
  // Watchlist
  getWatchlist: () => _db.watchlist,
  addToWatchlist: (item) => {
    if (!_db.watchlist.find(w => w.ticker === item.ticker)) {
      _db.watchlist.push({ ...item, addedAt: Date.now() });
      save(_db);
    }
  },
  removeFromWatchlist: (ticker) => {
    _db.watchlist = _db.watchlist.filter(w => w.ticker !== ticker);
    save(_db);
  },
  
  // Filings
  getFilings: (ticker) => ticker 
    ? _db.filings.filter(f => f.ticker === ticker)
    : _db.filings,
  addFiling: (filing) => {
    const exists = _db.filings.find(f => f.accessionNumber === filing.accessionNumber);
    if (!exists) {
      _db.filings.push(filing);
      save(_db);
      return true;
    }
    return false;
  },
  
  // Contradictions
  getContradictions: (ticker) => ticker
    ? _db.contradictions.filter(c => c.ticker === ticker)
    : _db.contradictions,
  addContradiction: (c) => {
    _db.contradictions.push({ ...c, detectedAt: Date.now() });
    save(_db);
  },
  clearContradictions: (ticker) => {
    _db.contradictions = _db.contradictions.filter(c => c.ticker !== ticker);
    save(_db);
  },
  
  // Notes
  getNotes: (ticker) => ticker
    ? _db.notes.filter(n => n.ticker === ticker)
    : _db.notes,
  saveNote: (note) => {
    const idx = _db.notes.findIndex(n => n.id === note.id);
    if (idx >= 0) _db.notes[idx] = note;
    else _db.notes.push(note);
    save(_db);
  },
  
  // Price cache
  getPrice: (ticker) => _db.prices[ticker] || null,
  setPrice: (ticker, data) => {
    _db.prices[ticker] = { ...data, updatedAt: Date.now() };
    save(_db);
  }
};
