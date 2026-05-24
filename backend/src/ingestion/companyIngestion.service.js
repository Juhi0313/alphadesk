import { getCIK, getSubmissions } from '../providers/sec.provider.js';
import { getQuote } from '../providers/yahoo.provider.js';
import { searchBSECompany, getBSEQuote } from '../providers/bse.provider.js';
import { upsertCompany, updateCompanyStatus } from '../db/repositories/company.repo.js';
import { logger } from '../utils/logger.js';

export async function ingestUSCompany(ticker) {
  logger.info(`[Ingest] US company: ${ticker}`);
  const quote = await getQuote(ticker);
  const cik = await getCIK(ticker);
  const id = upsertCompany({
    symbol: ticker,
    company_name: quote?.company_name || ticker,
    country: 'US',
    exchange: quote?.exchange,
    cik: cik,
    status: 'loading'
  });
  if (cik) {
    try {
      const subs = await getSubmissions(cik);
      upsertCompany({
        symbol: ticker,
        company_name: subs.name || quote?.company_name || ticker,
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
  return { id, ticker, quote, cik };
}

export async function ingestIndianCompany(ticker) {
  logger.info(`[Ingest] Indian company: ${ticker}`);
  const cleanTicker = ticker.replace('.NS', '').replace('.BO', '');
  const bseInfo = await searchBSECompany(cleanTicker);
  const quote = await getQuote(ticker) || await getBSEQuote(bseInfo?.bse_code);
  const id = upsertCompany({
    symbol: ticker,
    company_name: bseInfo?.company_name || quote?.company_name || ticker,
    country: 'IN',
    bse_code: bseInfo?.bse_code,
    status: 'ready'
  });
  return { id, ticker, quote, bseInfo };
}
