import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';

export async function getQuote(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    return {
      symbol: ticker,
      price: meta.regularMarketPrice,
      prev_close: meta.chartPreviousClose || meta.previousClose,
      change: meta.regularMarketPrice - (meta.chartPreviousClose || meta.previousClose),
      change_pct: ((meta.regularMarketPrice - (meta.chartPreviousClose || meta.previousClose)) / (meta.chartPreviousClose || meta.previousClose) * 100),
      currency: meta.currency,
      exchange: meta.exchangeName,
      company_name: meta.shortName || meta.longName,
      market_cap: meta.marketCap,
      low: meta.regularMarketDayLow,
      high: meta.regularMarketDayHigh,
      volume: meta.regularMarketVolume
    };
  } catch (e) {
    logger.warn('[Yahoo] getQuote error', e.message);
    return null;
  }
}

export async function getHistoricalPrices(ticker, range = '1mo') {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=${range}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return [];
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return [];
    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    return timestamps.map((ts, i) => ({ date: new Date(ts * 1000).toISOString().slice(0, 10), close: closes[i] })).filter(p => p.close != null);
  } catch (e) {
    logger.warn('[Yahoo] getHistoricalPrices error', e.message);
    return [];
  }
}
