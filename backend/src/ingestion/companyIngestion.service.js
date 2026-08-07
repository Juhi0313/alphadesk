import { getCIK, getSubmissions } from '../providers/sec.provider.js';
import { getQuote } from '../providers/yahoo.provider.js';
import { searchBSECompany, getBSEQuote } from '../providers/bse.provider.js';
import { upsertCompany, updateCompanyStatus } from '../db/repositories/company.repo.js';
import { logger } from '../utils/logger.js';

export async function ingestUSCompany(ticker) {
  logger.info(`[Ingest] US company: ${ticker}`);
  const [quote, cik] = await Promise.all([getQuote(ticker), getCIK(ticker)]);
  const id = upsertCompany({
    symbol: ticker,
    company_name: quote?.company_name || ticker,
    country: 'US',
    exchange: quote?.exchange,
    cik: cik,
    status: 'loading'
  });
  let submissions = null;
  if (cik) {
    try {
      submissions = await getSubmissions(cik);
      upsertCompany({
        symbol: ticker,
        company_name: submissions.name || quote?.company_name || ticker,
        country: 'US',
        exchange: quote?.exchange,
        cik,
        status: 'ready'
      });
    } catch (e) {
      logger.warn(`[Ingest] submissions fetch failed for ${ticker}`, e.message);
      updateCompanyStatus(ticker, 'ready');
    }
  } else {
    updateCompanyStatus(ticker, 'ready');
  }
  return { id, ticker, quote, cik, submissions };
}

export async function lookupIndianCompany(ticker) {
  const cleanTicker = ticker.replace('.NS', '').replace('.BO', '');
  const [bseInfo, yahooQuote] = await Promise.all([searchBSECompany(cleanTicker), getQuote(ticker)]);
  const quote = yahooQuote || (bseInfo?.bse_code ? await getBSEQuote(bseInfo.bse_code) : null);
  return { bseInfo, quote };
}

export async function ingestIndianCompany(ticker, prefetched = null) {
  logger.info(`[Ingest] Indian company: ${ticker}`);
  const { bseInfo, quote } = prefetched || await lookupIndianCompany(ticker);
  const id = upsertCompany({
    symbol: ticker,
    company_name: bseInfo?.company_name || quote?.company_name || ticker,
    country: 'IN',
    bse_code: bseInfo?.bse_code,
    status: 'ready'
  });
  return { id, ticker, quote, bseInfo };
}
