import { getSqlite } from '../db.js';
import { randomUUID } from 'crypto';

export function saveFlag(flag) {
  const db = getSqlite();
  const now = new Date().toISOString();
  const id = randomUUID();
  db.prepare(`INSERT INTO approved_flags (id,company_id,filing_id,candidate_id,claim_id,signal_id,ticker,topic,severity,bullish_claim,bearish_signal,magnitude,final_explanation,safe_wording,audit_score,bull_objection,bear_argument,ai_generated,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, flag.company_id, flag.filing_id, flag.candidate_id, flag.claim_id, flag.signal_id, flag.ticker, flag.topic, flag.severity || 'MEDIUM', flag.bullish_claim, flag.bearish_signal, flag.magnitude, flag.final_explanation, flag.safe_wording, flag.audit_score ?? 0.8, flag.bull_objection, flag.bear_argument, 1, now);
  return id;
}

export function getFlags(ticker) {
  return getSqlite().prepare('SELECT * FROM approved_flags WHERE ticker=? ORDER BY created_at DESC').all(ticker);
}

export function getFlagById(id) {
  return getSqlite().prepare('SELECT * FROM approved_flags WHERE id=?').get(id) || null;
}

export function clearFlags(ticker) {
  getSqlite().prepare('DELETE FROM approved_flags WHERE ticker=?').run(ticker);
}

export function getAllFlags() {
  return getSqlite().prepare('SELECT * FROM approved_flags ORDER BY created_at DESC').all();
}
