import { getSqlite } from '../db.js';
import { randomUUID } from 'crypto';

export function upsertFiling({ company_id, symbol, form_type, filing_date, accession_number, primary_document, source_url, direct_url, status = 'pending' }) {
  const db = getSqlite();
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT id FROM filings WHERE accession_number = ?').get(accession_number);
  if (existing) {
    db.prepare(`UPDATE filings SET status=?, direct_url=? WHERE id=?`).run(status, direct_url, existing.id);
    return existing.id;
  }
  const id = randomUUID();
  db.prepare(`INSERT INTO filings (id,company_id,symbol,form_type,filing_date,accession_number,primary_document,source_url,direct_url,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, company_id, symbol, form_type, filing_date, accession_number, primary_document, source_url, direct_url, status, now);
  return id;
}

export function getFilings(symbol) {
  return getSqlite().prepare('SELECT * FROM filings WHERE symbol = ? ORDER BY filing_date DESC').all(symbol);
}

export function getFilingById(id) {
  return getSqlite().prepare('SELECT * FROM filings WHERE id = ?').get(id) || null;
}

export function updateFilingStatus(id, status, extra = {}) {
  const db = getSqlite();
  const sets = ['status = ?'];
  const vals = [status];
  if (extra.clean_text_path) { sets.push('clean_text_path = ?'); vals.push(extra.clean_text_path); }
  if (extra.raw_text_hash) { sets.push('raw_text_hash = ?'); vals.push(extra.raw_text_hash); }
  vals.push(id);
  db.prepare(`UPDATE filings SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}
