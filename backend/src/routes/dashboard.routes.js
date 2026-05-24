import { Router } from 'express';
import { getAllCompanies } from '../db/repositories/company.repo.js';
import { getAllFlags } from '../db/repositories/flag.repo.js';
import { getSqlite } from '../db/db.js';

export function createDashboardRouter() {
  const router = Router();

  router.get('/summary', (req, res) => {
    const companies = getAllCompanies();
    const flags = getAllFlags();
    const db = getSqlite();
    const recentScans = db.prepare('SELECT * FROM scan_runs ORDER BY started_at DESC LIMIT 10').all();
    const highFlags = flags.filter(f => f.severity === 'HIGH').length;
    const medFlags = flags.filter(f => f.severity === 'MEDIUM').length;
    res.json({
      total_companies: companies.length,
      total_flags: flags.length,
      high_severity: highFlags,
      medium_severity: medFlags,
      recent_scans: recentScans,
      watchlist: companies.map(c => ({
        symbol: c.symbol,
        company_name: c.company_name,
        flag_count: flags.filter(f => f.ticker === c.symbol).length,
        status: c.status
      }))
    });
  });

  router.get('/flags', (req, res) => {
    const flags = getAllFlags();
    res.json(flags);
  });

  return router;
}
