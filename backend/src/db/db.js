import Database from 'better-sqlite3';
import { SCHEMA } from './schema.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
let _db = null;

export function initSqlite() {
  const dbPath = process.env.DB_PATH || join(__dirname, '../../../data/alphadesk.db');
  const dir = dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.exec(SCHEMA);
  console.log('[SQLite] Initialized at', dbPath);
  return _db;
}

export function getSqlite() {
  if (!_db) throw new Error('SQLite not initialized. Call initSqlite() first.');
  return _db;
}
