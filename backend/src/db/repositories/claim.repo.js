import { getSqlite } from '../db.js';
import { randomUUID } from 'crypto';

export function saveClaims(claims) {
  const db = getSqlite();
  const now = new Date().toISOString();
  const insert = db.prepare(`INSERT INTO narrative_claims (id,company_id,filing_id,section_id,claim_type,sentiment,claim_text,char_start,char_end,confidence,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const insertMany = db.transaction((rows) => {
    for (const r of rows) insert.run(randomUUID(), r.company_id, r.filing_id, r.section_id, r.claim_type, r.sentiment || 'positive', r.claim_text, r.char_start, r.char_end, r.confidence ?? 0.8, now);
  });
  insertMany(claims);
}

export function getClaims(company_id, filing_id) {
  if (filing_id) return getSqlite().prepare('SELECT * FROM narrative_claims WHERE company_id=? AND filing_id=?').all(company_id, filing_id);
  return getSqlite().prepare('SELECT * FROM narrative_claims WHERE company_id=?').all(company_id);
}
