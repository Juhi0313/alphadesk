import { getSqlite } from '../db.js';
import { randomUUID } from 'crypto';

export function createScanRun({ company_id, filing_id, symbol }) {
  const db = getSqlite();
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO scan_runs (id,company_id,filing_id,symbol,status,started_at) VALUES (?,?,?,?,?,?)`)
    .run(id, company_id, filing_id, symbol, 'running', now);
  return id;
}

export function updateScanRun(id, { status, error_message, approved_flags_count, rejected_candidates_count }) {
  const db = getSqlite();
  const now = new Date().toISOString();
  db.prepare(`UPDATE scan_runs SET status=?, completed_at=?, error_message=?, approved_flags_count=?, rejected_candidates_count=? WHERE id=?`)
    .run(status, now, error_message, approved_flags_count ?? 0, rejected_candidates_count ?? 0, id);
}

export function getScanRuns(symbol) {
  return getSqlite().prepare('SELECT * FROM scan_runs WHERE symbol=? ORDER BY started_at DESC').all(symbol);
}

export function getScanRunById(id) {
  return getSqlite().prepare('SELECT * FROM scan_runs WHERE id=?').get(id) || null;
}
