import { getSqlite } from '../db.js';
import { randomUUID } from 'crypto';

export function saveSections(sections) {
  const db = getSqlite();
  const now = new Date().toISOString();
  const insert = db.prepare(`INSERT OR IGNORE INTO filing_sections (id,filing_id,section_key,section_title,char_start,char_end,text_hash,created_at) VALUES (?,?,?,?,?,?,?,?)`);
  const insertMany = db.transaction((rows) => { for (const r of rows) insert.run(randomUUID(), r.filing_id, r.section_key, r.section_title, r.char_start, r.char_end, r.text_hash, now); });
  insertMany(sections);
}

export function getSections(filing_id) {
  return getSqlite().prepare('SELECT * FROM filing_sections WHERE filing_id = ? ORDER BY char_start').all(filing_id);
}
