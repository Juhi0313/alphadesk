import { getCompanyFacts } from '../providers/sec.provider.js';
import { saveFacts } from '../db/repositories/fact.repo.js';
import { getCompany } from '../db/repositories/company.repo.js';
import { logger } from '../utils/logger.js';

const KEY_METRICS = [
  { key: 'Revenues', label: 'Revenue' },
  { key: 'NetIncomeLoss', label: 'Net Income' },
  { key: 'EarningsPerShareDiluted', label: 'EPS Diluted' },
  { key: 'OperatingIncomeLoss', label: 'Operating Income' },
  { key: 'GrossProfit', label: 'Gross Profit' },
  { key: 'Assets', label: 'Total Assets' },
  { key: 'LongTermDebt', label: 'Long-Term Debt' },
  { key: 'CashAndCashEquivalentsAtCarryingValue', label: 'Cash' },
  { key: 'CommonStockSharesOutstanding', label: 'Shares Outstanding' },
  { key: 'OperatingCashFlow', label: 'Operating Cash Flow' },
];

export async function extractXBRLFacts(ticker, company_id, filing_id) {
  const company = getCompany(ticker);
  if (!company?.cik) return [];
  let factsData;
  try {
    factsData = await getCompanyFacts(company.cik);
  } catch (e) {
    logger.warn(`[FactExtractor] XBRL fetch failed for ${ticker}`, e.message);
    return [];
  }
  if (!factsData) return [];

  const usgaap = factsData.facts?.['us-gaap'] || {};
  const extracted = [];

  for (const { key, label } of KEY_METRICS) {
    const entry = usgaap[key];
    if (!entry) continue;
    const units = entry.units;
    const unitKey = Object.keys(units || {})[0];
    if (!unitKey) continue;
    const values = units[unitKey];
    if (!values?.length) continue;

    // Get the most recent annual (10-K) value
    const annual = values.filter(v => v.form === '10-K' || v.frame?.startsWith('CY')).sort((a, b) => b.end?.localeCompare(a.end));
    if (!annual.length) continue;

    const current = annual[0];
    const prior = annual[1];
    const changePct = prior?.val ? ((current.val - prior.val) / Math.abs(prior.val) * 100) : null;

    extracted.push({
      company_id,
      filing_id,
      metric: label,
      period: current.end,
      value: current.val,
      prior_value: prior?.val,
      change_percent: changePct,
      currency: unitKey === 'USD' ? 'USD' : null,
      unit: unitKey,
      source_type: 'xbrl',
      source_locator: key,
      confidence: 1.0
    });
  }

  if (extracted.length > 0) saveFacts(extracted);
  logger.info(`[FactExtractor] Extracted ${extracted.length} XBRL facts for ${ticker}`);
  return extracted;
}
