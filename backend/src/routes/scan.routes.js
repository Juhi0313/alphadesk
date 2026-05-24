import { Router } from 'express';
import { validateTicker } from '../utils/validateTicker.js';
import { getCompany } from '../db/repositories/company.repo.js';
import { getFilings } from '../db/repositories/filing.repo.js';
import { getFlags, clearFlags } from '../db/repositories/flag.repo.js';
import { getScanRuns, getScanRunById } from '../db/repositories/scanRun.repo.js';
import { getAuditEvents } from '../db/repositories/audit.repo.js';
import { runSwarm } from '../swarm/swarmRunner.js';
import { badRequest, notFound } from '../utils/errors.js';

export function createScanRouter(broadcast) {
  const router = Router();

  router.post('/:ticker', async (req, res, next) => {
    try {
      const { valid, ticker } = validateTicker(req.params.ticker);
      if (!valid) return next(badRequest('Invalid ticker'));
      const company = getCompany(ticker);
      if (!company) return next(notFound(`Company not found: ${ticker}`));
      const filings = getFilings(ticker);
      const filing = filings.find(f => f.form_type === '10-K' || f.form_type === 'Annual Report') || filings[0];
      if (!filing) return next(badRequest('No filings available to scan'));

      // Run in background, return immediately
      res.json({ status: 'started', ticker, filing_id: filing.id });
      runSwarm({ ticker, filing, broadcastFn: broadcast }).catch(e => console.error(`[Scan] ${ticker}:`, e.message));
    } catch (e) { next(e); }
  });

  router.get('/:ticker/flags', (req, res, next) => {
    const { valid, ticker } = validateTicker(req.params.ticker);
    if (!valid) return next(badRequest('Invalid ticker'));
    res.json(getFlags(ticker));
  });

  router.delete('/:ticker/flags', (req, res, next) => {
    const { valid, ticker } = validateTicker(req.params.ticker);
    if (!valid) return next(badRequest('Invalid ticker'));
    clearFlags(ticker);
    broadcast('FLAGS_CLEARED', { ticker });
    res.json({ cleared: ticker });
  });

  router.get('/:ticker/runs', (req, res, next) => {
    const { valid, ticker } = validateTicker(req.params.ticker);
    if (!valid) return next(badRequest('Invalid ticker'));
    res.json(getScanRuns(ticker));
  });

  router.get('/run/:runId/audit', (req, res, next) => {
    const run = getScanRunById(req.params.runId);
    if (!run) return next(notFound('Scan run not found'));
    res.json({ run, events: getAuditEvents(run.id) });
  });

  return router;
}
