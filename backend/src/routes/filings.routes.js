import { Router } from 'express';
import { validateTicker } from '../utils/validateTicker.js';
import { getFilings, getFilingById } from '../db/repositories/filing.repo.js';
import { getSections } from '../db/repositories/section.repo.js';
import { getFacts } from '../db/repositories/fact.repo.js';
import { getClaims } from '../db/repositories/claim.repo.js';
import { getSignals } from '../db/repositories/signal.repo.js';
import { getCompany } from '../db/repositories/company.repo.js';
import { badRequest, notFound } from '../utils/errors.js';

export function createFilingsRouter() {
  const router = Router();

  router.get('/:ticker', (req, res, next) => {
    const { valid, ticker } = validateTicker(req.params.ticker);
    if (!valid) return next(badRequest('Invalid ticker'));
    res.json(getFilings(ticker));
  });

  router.get('/:ticker/:filingId', (req, res, next) => {
    const { valid, ticker } = validateTicker(req.params.ticker);
    if (!valid) return next(badRequest('Invalid ticker'));
    const filing = getFilingById(req.params.filingId);
    if (!filing || filing.symbol !== ticker) return next(notFound('Filing not found'));
    const company = getCompany(ticker);
    const sections = getSections(filing.id);
    const facts = getFacts(company?.id, filing.id);
    const claims = getClaims(company?.id, filing.id);
    const signals = getSignals(company?.id, filing.id);
    res.json({ filing, sections, facts, claims, signals });
  });

  return router;
}
