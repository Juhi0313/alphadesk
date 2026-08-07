import { getRecentFilings, extractRecentFilings } from '../providers/sec.provider.js';
import { getBSEFilings as getBSEFilingsList } from '../providers/bse.provider.js';
import { upsertFiling } from '../db/repositories/filing.repo.js';
import { getCompany } from '../db/repositories/company.repo.js';
import { logger } from '../utils/logger.js';

export async function ingestUSFilings(ticker, submissions = null) {
  const company = getCompany(ticker);
  if (!company?.cik) {
    logger.warn(`[FilingIngest] No CIK for ${ticker}`);
    return [];
  }
  let filings;
  try {
    filings = submissions
      ? extractRecentFilings(submissions, company.cik)
      : await getRecentFilings(company.cik);
  } catch (e) {
    logger.warn(`[FilingIngest] getRecentFilings failed for ${ticker}`, e.message);
    return [];
  }
  const saved = [];
  for (const f of filings) {
    const id = upsertFiling({
      company_id: company.id,
      symbol: ticker,
      form_type: f.form_type,
      filing_date: f.filing_date,
      accession_number: f.accession_number,
      primary_document: f.primary_document,
      source_url: f.source_url,
      direct_url: f.direct_url,
      status: 'pending'
    });
    saved.push({ id, ...f });
  }
  logger.info(`[FilingIngest] Saved ${saved.length} filings for ${ticker}`);
  return saved;
}

export async function ingestIndianFilings(ticker) {
  const company = getCompany(ticker);
  if (!company?.bse_code) {
    logger.warn(`[FilingIngest] No BSE code for ${ticker}`);
    return [];
  }
  let filings;
  try {
    filings = await getBSEFilingsList(company.bse_code);
  } catch (e) {
    logger.warn(`[FilingIngest] BSE filings failed for ${ticker}`, e.message);
    return [];
  }
  const saved = [];
  for (const f of filings) {
    const id = upsertFiling({
      company_id: company.id,
      symbol: ticker,
      form_type: f.form_type,
      filing_date: f.filing_date,
      accession_number: f.accession_number,
      direct_url: f.direct_url,
      source_url: f.source_url,
      status: 'pending'
    });
    saved.push({ id, ...f });
  }
  return saved;
}
