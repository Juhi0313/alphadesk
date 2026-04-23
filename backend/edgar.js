import fetch from 'node-fetch';

async function fetchWithTimeout(url, options = {}, ms = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const EDGAR_BASE = 'https://data.sec.gov';
const EDGAR_SEARCH = 'https://efts.sec.gov/LATEST/search-index';
const COMPANY_FACTS = 'https://data.sec.gov/api/xbrl/companyfacts';

const headers = {
  'User-Agent': 'AnalystCopilot research@analystcopilot.com',
  'Accept': 'application/json'
};

// Get company CIK from ticker
export async function getCIK(ticker) {
  try {
    const res = await fetchWithTimeout(
      `https://efts.sec.gov/LATEST/search-index?q=%22${ticker}%22&dateRange=custom&startdt=2020-01-01&forms=10-K`,
      { headers }
    );
    // Use the tickers.json mapping instead
    const tickerRes = await fetchWithTimeout(
      `https://www.sec.gov/files/company_tickers.json`,
      { headers }
    );
    const data = await tickerRes.json();
    const entry = Object.values(data).find(
      c => c.ticker.toUpperCase() === ticker.toUpperCase()
    );
    if (entry) {
      return String(entry.cik_str).padStart(10, '0');
    }
    return null;
  } catch (e) {
    console.error('getCIK error:', e.message);
    return null;
  }
}

// Get company submissions (filings list)
export async function getSubmissions(cik) {
  try {
    const res = await fetchWithTimeout(
      `${EDGAR_BASE}/submissions/CIK${cik}.json`,
      { headers }
    );
    return await res.json();
  } catch (e) {
    console.error('getSubmissions error:', e.message);
    return null;
  }
}

// Get recent 10-K and 10-Q filings
export async function getRecentFilings(cik, ticker) {
  const submissions = await getSubmissions(cik);
  if (!submissions) return [];

  const recent = submissions.filings?.recent;
  if (!recent) return [];

  const filings = [];
  const forms = recent.form || [];
  const dates = recent.filingDate || [];
  const accessions = recent.accessionNumber || [];
  const descriptions = recent.primaryDocument || [];

  for (let i = 0; i < forms.length; i++) {
    if (['10-K', '10-Q', '8-K'].includes(forms[i])) {
      const accession = accessions[i].replace(/-/g, '');
      const accessionDashed = accessions[i]; // e.g. 0000789019-24-000077
      const indexUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${accession}/${accessionDashed}-index.htm`;
      const directUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${accession}/${descriptions[i]}`;
      filings.push({
        ticker,
        cik,
        form: forms[i],
        filingDate: dates[i],
        accessionNumber: accessions[i],
        primaryDocument: descriptions[i],
        url: indexUrl,
        directUrl: directUrl,
        indexUrl
      });
    }
    if (filings.length >= 20) break;
  }
  return filings;
}

// Get company financial facts from XBRL
export async function getCompanyFacts(cik) {
  try {
    const res = await fetchWithTimeout(
      `${COMPANY_FACTS}/CIK${cik}.json`,
      { headers }
    );
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error('getCompanyFacts error:', e.message);
    return null;
  }
}

// Extract key financials from XBRL facts
export function extractKeyMetrics(facts) {
  if (!facts?.facts) return {};
  
  const us_gaap = facts.facts['us-gaap'] || {};
  const dei = facts.facts['dei'] || {};
  
  const getLatestValue = (concept) => {
    const data = us_gaap[concept];
    if (!data?.units) return null;
    const units = Object.values(data.units)[0] || [];
    // Get annual (10-K) values sorted by end date
    const annual = units
      .filter(u => u.form === '10-K' && u.val !== undefined)
      .sort((a, b) => new Date(b.end) - new Date(a.end));
    if (annual.length === 0) return null;
    return { current: annual[0]?.val, prior: annual[1]?.val, date: annual[0]?.end };
  };

  const revenue = getLatestValue('Revenues') || 
                  getLatestValue('RevenueFromContractWithCustomerExcludingAssessedTax') ||
                  getLatestValue('SalesRevenueNet');
  
  const netIncome = getLatestValue('NetIncomeLoss');
  const assets = getLatestValue('Assets');
  const liabilities = getLatestValue('Liabilities');
  const cashflow = getLatestValue('NetCashProvidedByUsedInOperatingActivities');
  const eps = getLatestValue('EarningsPerShareBasic');
  const shares = getLatestValue('CommonStockSharesOutstanding') ||
                 getLatestValue('CommonStockSharesIssued');

  return {
    revenue: revenue || null,
    netIncome: netIncome || null,
    assets: assets || null,
    liabilities: liabilities || null,
    operatingCashflow: cashflow || null,
    eps: eps || null,
    shares: shares || null,
    entityName: facts.entityName || '',
    cik: facts.cik || ''
  };
}

// Fetch filing document text (first 50KB for analysis)
// If the URL is a filing index page, extract the primary document URL
async function resolveDocumentUrl(url) {
  if (!url.includes('-index.htm')) return url;
  try {
    const res = await fetchWithTimeout(url, { headers }, 10000);
    const html = await res.text();
    // Find all EDGAR .htm links, skip inline XBRL viewer files (R1.htm, R2.htm...)
    const matches = [...html.matchAll(/href="(\/Archives\/edgar\/data\/[^"]+\.htm)"/gi)];
    for (const m of matches) {
      const filename = m[1].split('/').pop();
      if (/^R\d+\.htm$/i.test(filename)) continue; // skip XBRL R-files
      if (/^(ex|exhibit)/i.test(filename)) continue; // skip exhibits
      return `https://www.sec.gov${m[1]}`;
    }
    if (matches.length > 0) return `https://www.sec.gov${matches[0][1]}`;
  } catch(e) {}
  return url;
}

export async function fetchFilingText(url) {
  try {
    const docUrl = await resolveDocumentUrl(url);
    // Use Range header to fetch only the first 300KB — avoids downloading 15MB files
    const res = await fetchWithTimeout(docUrl, {
      headers: {
        ...headers,
        'Accept': 'text/html,text/plain',
        'Range': 'bytes=0-307200'
      }
    }, 10000);
    const text = await res.text();
    return text
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .slice(0, 250000);
  } catch (e) {
    console.error('fetchFilingText error:', e.message);
    return '';
  }
}

// Get stock quote from Yahoo Finance (free, no API key)
export async function getStockQuote(ticker) {
  try {
    const res = await fetchWithTimeout(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
      { 
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;
    
    const meta = result.meta;
    return {
      ticker,
      price: meta.regularMarketPrice,
      previousClose: meta.previousClose || meta.chartPreviousClose,
      change: meta.regularMarketPrice - (meta.previousClose || meta.chartPreviousClose),
      changePercent: ((meta.regularMarketPrice - (meta.previousClose || meta.chartPreviousClose)) / (meta.previousClose || meta.chartPreviousClose)) * 100,
      volume: meta.regularMarketVolume,
      marketCap: meta.marketCap,
      high: meta.regularMarketDayHigh,
      low: meta.regularMarketDayLow,
      currency: meta.currency,
      exchange: meta.exchangeName
    };
  } catch (e) {
    console.error('getStockQuote error:', e.message);
    return null;
  }
}

// Get historical prices for sparkline (free Yahoo Finance)
export async function getHistoricalPrices(ticker, days = 30) {
  try {
    const res = await fetchWithTimeout(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=${days}d`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return [];
    
    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    
    return timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().split('T')[0],
      price: closes[i] || null
    })).filter(p => p.price !== null);
  } catch (e) {
    return [];
  }
}
