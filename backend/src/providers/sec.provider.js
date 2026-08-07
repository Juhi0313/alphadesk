import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';

const EDGAR_BASE = 'https://data.sec.gov';
const EDGAR_ARCHIVES = 'https://www.sec.gov/Archives/edgar/full-index';
const SUBMISSIONS_BASE = 'https://data.sec.gov/submissions';
const HEADERS = { 'User-Agent': 'AlphaDesk/2.0 research@alphadesk.ai' };

let tickerMapCache = null;
let tickerMapCachePromise = null;

async function getTickerMap() {
  if (tickerMapCache) return tickerMapCache;
  if (tickerMapCachePromise) return tickerMapCachePromise;
  tickerMapCachePromise = (async () => {
    const mapUrl = 'https://www.sec.gov/files/company_tickers.json';
    const res = await fetch(mapUrl, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`SEC ticker map fetch failed: ${res.status}`);
    const data = await res.json();
    const bySymbol = new Map();
    for (const entry of Object.values(data)) {
      if (entry.ticker) bySymbol.set(entry.ticker.toUpperCase(), entry);
    }
    tickerMapCache = bySymbol;
    return bySymbol;
  })();
  try {
    return await tickerMapCachePromise;
  } finally {
    tickerMapCachePromise = null;
  }
}

export async function getCIK(ticker) {
  try {
    const map = await getTickerMap();
    const entry = map.get(ticker.toUpperCase());
    if (entry) return String(entry.cik_str).padStart(10, '0');
  } catch (e) {
    logger.warn('[SEC] ticker map lookup failed', e.message);
  }
  return null;
}

export async function getSubmissions(cik) {
  const url = `${SUBMISSIONS_BASE}/CIK${cik}.json`;
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`SEC submissions fetch failed: ${res.status}`);
  return res.json();
}

export function extractRecentFilings(data, cik, formTypes = ['10-K', '10-Q']) {
  const filings = data.filings?.recent || {};
  const results = [];
  const forms = filings.form || [];
  for (let i = 0; i < forms.length; i++) {
    if (formTypes.includes(forms[i])) {
      const accNum = filings.accessionNumber?.[i]?.replace(/-/g, '');
      results.push({
        form_type: forms[i],
        filing_date: filings.filingDate?.[i],
        accession_number: filings.accessionNumber?.[i],
        primary_document: filings.primaryDocument?.[i],
        source_url: `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${accNum}/`,
        direct_url: `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${accNum}/${filings.primaryDocument?.[i]}`
      });
      if (results.length >= 5) break;
    }
  }
  return results;
}

export async function getRecentFilings(cik, formTypes = ['10-K', '10-Q']) {
  const data = await getSubmissions(cik);
  return extractRecentFilings(data, cik, formTypes);
}

export async function getCompanyFacts(cik) {
  const url = `${EDGAR_BASE}/api/xbrl/companyfacts/CIK${cik}.json`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return null;
  return res.json();
}

export async function resolveFilingUrl(indexUrl) {
  try {
    const res = await fetch(indexUrl, { headers: HEADERS });
    if (!res.ok) return indexUrl;
    const html = await res.text();
    const match = html.match(/href="([^"]+\.htm)"/i);
    if (match) {
      const base = indexUrl.replace(/\/$/, '');
      return `${base}/${match[1].split('/').pop()}`;
    }
  } catch (e) {
    logger.warn('[SEC] resolveFilingUrl error', e.message);
  }
  return indexUrl;
}

export async function fetchFilingText(url) {
  try {
    const res = await fetch(url, {
      headers: { ...HEADERS, 'Range': 'bytes=0-307200' },
      signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) return '';
    const raw = await res.text();
    return raw
      .replace(/<[^>]*>/g, ' ')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
      .replace(/\s{3,}/g, '\n\n')
      .trim();
  } catch (e) {
    logger.warn('[SEC] fetchFilingText error', e.message);
    return '';
  }
}
