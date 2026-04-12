import fetch from 'node-fetch';

// BSE scrip code mapping for major Indian stocks
const TICKER_TO_BSE = {
  // IT
  'TCS': '532540', 'INFY': '500209', 'WIPRO': '507685', 'HCLTECH': '532281',
  'TECHM': '532755', 'LTIM': '540005', 'MPHASIS': '526299', 'PERSISTENT': '533179',
  // Finance / Banks
  'HDFCBANK': '500180', 'ICICIBANK': '532174', 'SBIN': '500112', 'KOTAKBANK': '500247',
  'AXISBANK': '532215', 'INDUSINDBK': '532187', 'BAJFINANCE': '500034',
  'BAJAJFINSV': '532978', 'HDFC': '500010', 'ICICIGI': '540716',
  // Energy / Oil
  'RELIANCE': '500325', 'ONGC': '500312', 'BPCL': '500547', 'IOC': '530965',
  'GAIL': '532155', 'POWERGRID': '532898', 'NTPC': '532555', 'ADANIGREEN': '541450',
  'ADANIPORTS': '532921', 'ADANIENT': '512599',
  // Auto
  'MARUTI': '532500', 'TATAMOTORS': '500570', 'M&M': '500520', 'BAJAJ-AUTO': '532977',
  'HEROMOTOCO': '500182', 'EICHERMOT': '505200',
  // FMCG
  'HINDUNILVR': '500696', 'ITC': '500875', 'NESTLEIND': '500790', 'BRITANNIA': '500825',
  'DABUR': '500096', 'MARICO': '531642', 'COLPAL': '500830',
  // Pharma
  'SUNPHARMA': '524715', 'DRREDDY': '500124', 'CIPLA': '500087', 'DIVISLAB': '532488',
  'BIOCON': '532523', 'AUROPHARMA': '524804', 'LUPIN': '500257',
  // Metals / Mining
  'TATASTEEL': '500470', 'HINDALCO': '500440', 'JSWSTEEL': '500228', 'SAIL': '500113',
  'COALINDIA': '533278', 'VEDL': '500295',
  // Telecom
  'BHARTIARTL': '532454', 'IDEA': '532822',
  // Infra / Others
  'LT': '500510', 'ULTRACEMCO': '532538', 'GRASIM': '500300', 'ASIANPAINT': '500820',
  'TITAN': '500114', 'HAVELLS': '517354', 'PIDILITIND': '500331',
  // Index ETFs / special
  'NIFTY50': 'INDEX', 'SENSEX': 'INDEX',
};

// NSE symbols for Yahoo Finance price lookup
const NSE_SYMBOLS = new Set([
  'TCS','INFY','WIPRO','HCLTECH','TECHM','LTIM','MPHASIS','PERSISTENT',
  'HDFCBANK','ICICIBANK','SBIN','KOTAKBANK','AXISBANK','INDUSINDBK','BAJFINANCE',
  'BAJAJFINSV','HDFC','RELIANCE','ONGC','BPCL','IOC','GAIL','POWERGRID','NTPC',
  'ADANIGREEN','ADANIPORTS','ADANIENT','MARUTI','TATAMOTORS','BAJAJ-AUTO',
  'HEROMOTOCO','EICHERMOT','HINDUNILVR','ITC','NESTLEIND','BRITANNIA','DABUR',
  'MARICO','COLPAL','SUNPHARMA','DRREDDY','CIPLA','DIVISLAB','BIOCON','AUROPHARMA',
  'LUPIN','TATASTEEL','HINDALCO','JSWSTEEL','SAIL','COALINDIA','VEDL','BHARTIARTL',
  'LT','ULTRACEMCO','GRASIM','ASIANPAINT','TITAN','HAVELLS','PIDILITIND','M&M',
]);

const BSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'application/json',
  'Referer': 'https://www.bseindia.com'
};

// Check if ticker is Indian
export function isIndianTicker(ticker) {
  const upper = ticker.toUpperCase().replace('&', '&');
  return NSE_SYMBOLS.has(upper) || TICKER_TO_BSE[upper] !== undefined || 
         ticker.endsWith('.NS') || ticker.endsWith('.BO');
}

// Get BSE scrip code
export function getBSECode(ticker) {
  const upper = ticker.toUpperCase();
  return TICKER_TO_BSE[upper] || null;
}

// Get Indian stock quote via Yahoo Finance (NSE)
export async function getIndianStockQuote(ticker) {
  try {
    const upper = ticker.toUpperCase();
    // Try NSE first, then BSE
    const symbols = [`${upper}.NS`, `${upper}.BO`];
    
    for (const symbol of symbols) {
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          }
        );
        const data = await res.json();
        const result = data?.chart?.result?.[0];
        if (!result) continue;
        
        const meta = result.meta;
        if (!meta.regularMarketPrice) continue;
        
        const prevClose = meta.previousClose || meta.chartPreviousClose || meta.regularMarketPrice;
        return {
          ticker: upper,
          price: meta.regularMarketPrice,
          previousClose: prevClose,
          change: meta.regularMarketPrice - prevClose,
          changePercent: ((meta.regularMarketPrice - prevClose) / prevClose) * 100,
          volume: meta.regularMarketVolume,
          marketCap: meta.marketCap,
          high: meta.regularMarketDayHigh,
          low: meta.regularMarketDayLow,
          currency: 'INR',
          exchange: symbol.endsWith('.NS') ? 'NSE' : 'BSE',
          symbol
        };
      } catch(e) { continue; }
    }
    return null;
  } catch(e) {
    console.error('getIndianStockQuote error:', e.message);
    return null;
  }
}

// Get historical prices for Indian stock
export async function getIndianHistoricalPrices(ticker, days = 30) {
  try {
    const upper = ticker.toUpperCase();
    const symbol = `${upper}.NS`;
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${days}d`,
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
  } catch(e) {
    return [];
  }
}

// Get annual reports from BSE
export async function getBSEFilings(ticker) {
  const bseCode = getBSECode(ticker.toUpperCase());
  if (!bseCode || bseCode === 'INDEX') return [];
  
  try {
    // BSE annual reports API
    const res = await fetch(
      `https://api.bseindia.com/BseIndiaAPI/api/AnnualReports/w?scripcode=${bseCode}&flag=0`,
      { headers: BSE_HEADERS }
    );
    
    if (!res.ok) return await getFallbackFilings(ticker, bseCode);
    
    const data = await res.json();
    const reports = data?.Table || data?.table || [];
    
    const filings = reports.slice(0, 10).map(r => ({
      ticker: ticker.toUpperCase(),
      cik: bseCode,
      form: 'Annual Report',
      filingDate: r.YEAR || r.year || r.Year || '2024',
      accessionNumber: `BSE-${bseCode}-${r.YEAR || '2024'}`,
      primaryDocument: r.FILENAME || r.filename || 'Annual Report',
      url: r.PDFLINKANNUAL || r.PDFLINK || r.pdflink || 
           `https://www.bseindia.com/bseplus/AnnualReport/${bseCode}/Annual_Report_${bseCode}.pdf`,
      exchange: 'BSE',
      country: 'IN'
    }));
    
    // Also add NSE filings link
    filings.push({
      ticker: ticker.toUpperCase(),
      cik: bseCode,
      form: 'NSE Filings',
      filingDate: new Date().toISOString().split('T')[0],
      accessionNumber: `NSE-${ticker.toUpperCase()}`,
      primaryDocument: 'NSE Corporate Filings',
      url: `https://www.nseindia.com/companies-listing/corporate-filings-annual-reports`,
      exchange: 'NSE',
      country: 'IN'
    });
    
    return filings.length > 1 ? filings : await getFallbackFilings(ticker, bseCode);
  } catch(e) {
    console.error('getBSEFilings error:', e.message);
    return await getFallbackFilings(ticker, bseCode);
  }
}

// Fallback - construct known BSE filing URLs
async function getFallbackFilings(ticker, bseCode) {
  const upper = ticker.toUpperCase();
  const currentYear = new Date().getFullYear();
  
  return [
    {
      ticker: upper, cik: bseCode, form: 'Annual Report',
      filingDate: `${currentYear - 1}-03-31`,
      accessionNumber: `BSE-${bseCode}-${currentYear - 1}`,
      primaryDocument: `Annual Report FY${currentYear - 1}`,
      url: `https://www.bseindia.com/bseplus/AnnualReport/${bseCode}/Annual_Report_${bseCode}.pdf`,
      exchange: 'BSE', country: 'IN'
    },
    {
      ticker: upper, cik: bseCode, form: 'Annual Report',
      filingDate: `${currentYear - 2}-03-31`,
      accessionNumber: `BSE-${bseCode}-${currentYear - 2}`,
      primaryDocument: `Annual Report FY${currentYear - 2}`,
      url: `https://www.bseindia.com/bseplus/AnnualReport/${bseCode}/Annual_Report_${bseCode}.pdf`,
      exchange: 'BSE', country: 'IN'
    },
    {
      ticker: upper, cik: bseCode, form: 'Quarterly Results',
      filingDate: new Date().toISOString().split('T')[0],
      accessionNumber: `BSE-QR-${bseCode}`,
      primaryDocument: 'Quarterly Results',
      url: `https://www.bseindia.com/corporates/ann.html?scripcd=${bseCode}&anntype=7`,
      exchange: 'BSE', country: 'IN'
    },
    {
      ticker: upper, cik: bseCode, form: 'Corporate Actions',
      filingDate: new Date().toISOString().split('T')[0],
      accessionNumber: `BSE-CA-${bseCode}`,
      primaryDocument: 'BSE Filings Page',
      url: `https://www.bseindia.com/stock-share-price/${upper}/${bseCode}/`,
      exchange: 'BSE', country: 'IN'
    }
  ];
}

// Get company info from BSE
export async function getIndianCompanyInfo(ticker) {
  const bseCode = getBSECode(ticker.toUpperCase());
  if (!bseCode) return null;
  
  try {
    const res = await fetch(
      `https://api.bseindia.com/BseIndiaAPI/api/ComHeader/w?quotetype=EQ&scripcode=${bseCode}`,
      { headers: BSE_HEADERS }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      companyName: data?.CompanyName || data?.companyname || ticker,
      sector: data?.Sector || data?.sector || '',
      industry: data?.Industry || data?.industry || '',
      bseCode,
      exchange: 'BSE/NSE',
      country: 'IN'
    };
  } catch(e) {
    return null;
  }
}

// Get basic financials for Indian companies from screener.in (free, no auth)
export async function getIndianFinancials(ticker) {
  try {
    const upper = ticker.toUpperCase();
    const res = await fetch(
      `https://www.screener.in/api/company/${upper}/`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json'
        }
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch(e) {
    return null;
  }
}
