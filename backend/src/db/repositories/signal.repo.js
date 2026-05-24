import { getSqlite } from '../db.js';
import { randomUUID } from 'crypto';

export function saveSignals(signals) {
  const db = getSqlite();
  const now = new Date().toISOString();
  const insert = db.prepare(`INSERT INTO financial_signals (id,company_id,filing_id,signal_type,metric,direction,severity,description,fact_ids_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const insertMany = db.transaction((rows) => {
    for (const r of rows) insert.run(randomUUID(), r.company_id, r.filing_id, r.signal_type, r.metric, r.direction || 'negative', r.severity || 'MEDIUM', r.description, JSON.stringify(r.fact_ids || []), now);
  });
  insertMany(signals);
}

export function getSignals(company_id, filing_id) {
  const rows = filing_id
    ? getSqlite().prepare('SELECT * FROM financial_signals WHERE company_id=? AND filing_id=?').all(company_id, filing_id)
    : getSqlite().prepare('SELECT * FROM financial_signals WHERE company_id=?').all(company_id);
  return rows.map(r => ({ ...r, fact_ids: JSON.parse(r.fact_ids_json || '[]') }));
}
