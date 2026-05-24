import { Router } from 'express';
import { validateTicker } from '../utils/validateTicker.js';
import { getQuote, getHistoricalPrices } from '../providers/yahoo.provider.js';
import { getBSEQuote } from '../providers/bse.provider.js';
import { getCompany } from '../db/repositories/company.repo.js';
import { getStoredPrice } from '../services/pricePolling.js';
import { badRequest } from '../utils/errors.js';

export function createQuotesRouter() {
  const router = Router();

  router.get('/:ticker', async (req, res, next) => {
    try {
      const { valid, ticker } = validateTicker(req.params.ticker);
      if (!valid) return next(badRequest('Invalid ticker'));
      const company = getCompany(ticker);
      let quote;
      if (company?.country === 'IN' && company?.bse_code) {
        quote = await getBSEQuote(company.bse_code) || await getQuote(ticker);
      } else {
        quote = await getQuote(ticker);
      }
      const stored = await getStoredPrice(ticker);
      res.json({ ...stored, ...quote, symbol: ticker });
    } catch (e) { next(e); }
  });

  router.get('/:ticker/history', async (req, res, next) => {
    try {
      const { valid, ticker } = validateTicker(req.params.ticker);
      if (!valid) return next(badRequest('Invalid ticker'));
      const range = req.query.range || '3mo';
      const history = await getHistoricalPrices(ticker, range);
      res.json(history);
    } catch (e) { next(e); }
  });

  return router;
}
