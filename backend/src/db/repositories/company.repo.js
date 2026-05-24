import { getSqlite } from '../db.js';
import { randomUUID } from 'crypto';

export function upsertCompany({ symbol, company_name, country = 'US', exchange, cik, bse_code, status = 'loading' }) {
  const db = getSqlite();
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT id FROM companies WHERE symbol = ?').get(symbol);
  if (existing) {
    db.prepare(`UPDATE companies SET company_name=?, country=?, exchange=?, cik=?, bse_code=?, status=?, updated_at=? WHERE symbol=?`)
      .run(company_name, country, exchange, cik, bse_code, status, now, symbol);
    return existing.id;
  }
  const id = randomUUID();
  db.prepare(`INSERT INTO companies (id,symbol,company_name,country,exchange,cik,bse_code,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(id, symbol, company_name, country, exchange, cik, bse_code, status, now, now);
  return id;
}

export function getCompany(symbol) {
  return getSqlite().prepare('SELECT * FROM companies WHERE symbol = ?').get(symbol) || null;
}

export function getAllCompanies() {
  return getSqlite().prepare('SELECT * FROM companies ORDER BY created_at DESC').all();
}

export function updateCompanyStatus(symbol, status) {
  const now = new Date().toISOString();
  getSqlite().prepare('UPDATE companies SET status=?, updated_at=? WHERE symbol=?').run(status, now, symbol);
}
