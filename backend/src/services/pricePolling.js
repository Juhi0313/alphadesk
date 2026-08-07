import { getAllCompanies } from '../db/repositories/company.repo.js';
import { getQuote } from '../providers/yahoo.provider.js';
import { getBSEQuote } from '../providers/bse.provider.js';
import { getSqlite } from '../db/db.js';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger.js';

const POLL_INTERVAL_MS = 60000;
let pollTimer = null;

export function startPricePolling(broadcastFn) {
  if (pollTimer) return;
  pollTimer = setInterval(() => pollAllPrices(broadcastFn), POLL_INTERVAL_MS);
  logger.info('[PricePolling] Started');
}

export function stopPricePolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

async function pollAllPrices(broadcast) {
  const companies = getAllCompanies();
  const prices = {};
  await Promise.allSettled(companies.map(async (c) => {
    const quote = await fetchQuoteForCompany(c);
    if (quote) {
      storePrice(c.symbol, quote);
      prices[c.symbol] = quote;
    }
  }));
  if (Object.keys(prices).length > 0) broadcast('PRICES_UPDATE', prices);
}

async function fetchQuoteForCompany(c) {
  try {
    if (c.country === 'IN' && c.bse_code) {
      return await getBSEQuote(c.bse_code);
    }
    return await getQuote(c.symbol);
  } catch (e) {
    logger.warn(`[PricePolling] Failed for ${c.symbol}`, e.message);
    return null;
  }
}

export async function fetchAndStorePrice(company, broadcast) {
  const quote = await fetchQuoteForCompany(company);
  if (quote) {
    storePrice(company.symbol, quote);
    if (broadcast) broadcast('PRICES_UPDATE', { [company.symbol]: quote });
  }
  return quote;
}

function storePrice(symbol, quote) {
  const db = getSqlite();
  const now = new Date().toISOString();
  db.prepare(`INSERT OR REPLACE INTO prices (id, symbol, price, change_pct, updated_at) VALUES (?, ?, ?, ?, ?)`)
    .run(randomUUID(), symbol, quote.price, quote.change_pct, now);
}

export async function getStoredPrice(symbol) {
  return getSqlite().prepare('SELECT * FROM prices WHERE symbol=?').get(symbol) || null;
}
