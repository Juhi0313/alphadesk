import { getSqlite } from '../db.js';
import { randomUUID } from 'crypto';

export function saveNote({ company_id, symbol, title, content_json, scan_run_id }) {
  const db = getSqlite();
  const now = new Date().toISOString();
  const id = randomUUID();
  db.prepare(`INSERT INTO research_notes (id,company_id,symbol,title,content_json,generated_from_scan_run_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, company_id, symbol, title, typeof content_json === 'string' ? content_json : JSON.stringify(content_json), scan_run_id, now, now);
  return id;
}

export function getNotes(symbol) {
  const rows = getSqlite().prepare('SELECT * FROM research_notes WHERE symbol=? ORDER BY created_at DESC').all(symbol);
  return rows.map(r => {
    try { return { ...r, content_json: JSON.parse(r.content_json) }; } catch { return r; }
  });
}

export function getNoteById(id) {
  const row = getSqlite().prepare('SELECT * FROM research_notes WHERE id=?').get(id);
  if (!row) return null;
  try { return { ...row, content_json: JSON.parse(row.content_json) }; } catch { return row; }
}

export function updateNote(id, { title, content_json }) {
  const db = getSqlite();
  const now = new Date().toISOString();
  db.prepare('UPDATE research_notes SET title=?, content_json=?, updated_at=? WHERE id=?')
    .run(title, typeof content_json === 'string' ? content_json : JSON.stringify(content_json), now, id);
}
