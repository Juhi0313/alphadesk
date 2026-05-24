import { Router } from 'express';
import { validateTicker } from '../utils/validateTicker.js';
import { ingestUSCompany, ingestIndianCompany } from '../ingestion/companyIngestion.service.js';
import { ingestUSFilings, ingestIndianFilings } from '../ingestion/filingIngestion.service.js';
import { getAllCompanies, getCompany } from '../db/repositories/company.repo.js';
import { getFilings } from '../db/repositories/filing.repo.js';
import { getFlags } from '../db/repositories/flag.repo.js';
import { getScanRuns } from '../db/repositories/scanRun.repo.js';
import { getQuote } from '../providers/yahoo.provider.js';
import { runSwarm } from '../swarm/swarmRunner.js';
import { badRequest, notFound } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export function createWatchlistRouter(broadcast) {
  const router = Router();

  router.get('/', (req, res) => {
    const companies = getAllCompanies();
    const result = companies.map(c => {
      const flags = getFlags(c.symbol);
      return { ...c, flag_count: flags.length, has_flags: flags.length > 0 };
    });
    res.json(result);
  });

  router.post('/', async (req, res, next) => {
    try {
      const { ticker: raw, country } = req.body;
      const { valid, ticker, error } = validateTicker(raw);
      if (!valid) return next(badRequest(error));

      const isIndian = country === 'IN' || ticker.endsWith('.NS') || ticker.endsWith('.BO');
      broadcast('STATUS', { message: `Adding ${ticker}...`, ticker });

      let ingestResult;
      if (isIndian) {
        ingestResult = await ingestIndianCompany(ticker);
        await ingestIndianFilings(ticker);
      } else {
        ingestResult = await ingestUSCompany(ticker);
        await ingestUSFilings(ticker);
      }

      // Auto-scan in background
      const filings = getFilings(ticker);
      const latestFiling = filings.find(f => f.form_type === '10-K' || f.form_type === 'Annual Report') || filings[0];
      if (latestFiling) {
        runSwarm({ ticker, filing: latestFiling, broadcastFn: broadcast }).catch(e => logger.warn(`[AutoScan] ${ticker}`, e.message));
      }

      res.json({ ticker, company: getCompany(ticker), filings });
    } catch (e) { next(e); }
  });

  router.delete('/:ticker', (req, res, next) => {
    try {
      const { valid, ticker } = validateTicker(req.params.ticker);
      if (!valid) return next(badRequest('Invalid ticker'));
      // Note: no hard delete from companies table — just return success
      res.json({ removed: ticker });
    } catch (e) { next(e); }
  });

  router.get('/:ticker', (req, res, next) => {
    const { valid, ticker } = validateTicker(req.params.ticker);
    if (!valid) return next(badRequest('Invalid ticker'));
    const company = getCompany(ticker);
    if (!company) return next(notFound(`Company not found: ${ticker}`));
    const filings = getFilings(ticker);
    const flags = getFlags(ticker);
    const scanRuns = getScanRuns(ticker);
    res.json({ company, filings, flags, scanRuns });
  });

  return router;
}
