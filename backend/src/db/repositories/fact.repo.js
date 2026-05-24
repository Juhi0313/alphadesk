import { getSqlite } from '../db.js';
import { randomUUID } from 'crypto';

export function saveFacts(facts) {
  const db = getSqlite();
  const now = new Date().toISOString();
  const insert = db.prepare(`INSERT OR IGNORE INTO financial_facts (id,company_id,filing_id,metric,period,value,prior_value,change_percent,currency,unit,source_type,source_locator,confidence,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const insertMany = db.transaction((rows) => {
    for (const r of rows) insert.run(randomUUID(), r.company_id, r.filing_id, r.metric, r.period, r.value, r.prior_value, r.change_percent, r.currency || 'USD', r.unit, r.source_type || 'xbrl', r.source_locator, r.confidence ?? 1.0, now);
  });
  insertMany(facts);
}

export function getFacts(company_id, filing_id) {
  if (filing_id) return getSqlite().prepare('SELECT * FROM financial_facts WHERE company_id=? AND filing_id=?').all(company_id, filing_id);
  return getSqlite().prepare('SELECT * FROM financial_facts WHERE company_id=?').all(company_id);
}
