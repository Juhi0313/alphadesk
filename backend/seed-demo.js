// seed-demo.js — Run this to populate demo data for testing
// node seed-demo.js

import { db } from './db.js';
import { generateResearchNote } from './contradictions.js';

const DEMO_COMPANIES = [
  { ticker: 'AAPL', cik: '0000320193', companyName: 'Apple Inc.' },
  { ticker: 'MSFT', cik: '0000789019', companyName: 'Microsoft Corporation' },
  { ticker: 'NVDA', cik: '0001045810', companyName: 'NVIDIA Corporation' },
  { ticker: 'TSLA', cik: '0001318605', companyName: 'Tesla, Inc.' },
];

const DEMO_PRICES = {
  AAPL: { ticker: 'AAPL', price: 213.49, previousClose: 209.82, change: 3.67, changePercent: 1.75, volume: 62345100, marketCap: 3241000000000, high: 214.20, low: 211.30, currency: 'USD', exchange: 'NASDAQ' },
  MSFT: { ticker: 'MSFT', price: 415.62, previousClose: 412.10, change: 3.52, changePercent: 0.85, volume: 18234500, marketCap: 3088000000000, high: 417.00, low: 413.50, currency: 'USD', exchange: 'NASDAQ' },
  NVDA: { ticker: 'NVDA', price: 875.40, previousClose: 862.19, change: 13.21, changePercent: 1.53, volume: 43567800, marketCap: 2155000000000, high: 880.00, low: 868.20, currency: 'USD', exchange: 'NASDAQ' },
  TSLA: { ticker: 'TSLA', price: 172.63, previousClose: 178.41, change: -5.78, changePercent: -3.24, volume: 98234000, marketCap: 550000000000, high: 179.00, low: 170.50, currency: 'USD', exchange: 'NASDAQ' },
};

const DEMO_FILINGS = [
  { ticker: 'AAPL', form: '10-K', filingDate: '2024-11-01', accessionNumber: '0000320193-24-000123', primaryDocument: 'aapl-20240928.htm', url: 'https://www.sec.gov/Archives/edgar/data/320193/000032019324000123/aapl-20240928.htm', cik: '0000320193' },
  { ticker: 'AAPL', form: '10-Q', filingDate: '2025-02-07', accessionNumber: '0000320193-25-000008', primaryDocument: 'aapl-20241228.htm', url: 'https://www.sec.gov/Archives/edgar/data/320193/000032019325000008/aapl-20241228.htm', cik: '0000320193' },
  { ticker: 'MSFT', form: '10-K', filingDate: '2024-07-30', accessionNumber: '0000789019-24-000077', primaryDocument: 'msft-20240630.htm', url: 'https://www.sec.gov/Archives/edgar/data/789019/000078901924000077/msft-20240630.htm', cik: '0000789019' },
  { ticker: 'MSFT', form: '10-Q', filingDate: '2025-01-29', accessionNumber: '0000789019-25-000007', primaryDocument: 'msft-20241231.htm', url: 'https://www.sec.gov/Archives/edgar/data/789019/000078901925000007/msft-20241231.htm', cik: '0000789019' },
  { ticker: 'NVDA', form: '10-K', filingDate: '2024-02-21', accessionNumber: '0001045810-24-000029', primaryDocument: 'nvda-20240128.htm', url: 'https://www.sec.gov/Archives/edgar/data/1045810/000104581024000029/nvda-20240128.htm', cik: '0001045810' },
  { ticker: 'TSLA', form: '10-K', filingDate: '2025-01-29', accessionNumber: '0001318605-25-000007', primaryDocument: 'tsla-20241231.htm', url: 'https://www.sec.gov/Archives/edgar/data/1318605/000131860525000007/tsla-20241231.htm', cik: '0001318605' },
  { ticker: 'TSLA', form: '8-K', filingDate: '2025-01-29', accessionNumber: '0001318605-25-000010', primaryDocument: 'tsla8k.htm', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001318605&type=8-K', cik: '0001318605' },
];

const DEMO_CONTRADICTIONS = [
  {
    id: 'TSLA-demo-001',
    ticker: 'TSLA',
    filingType: '10-K',
    topic: 'Demand vs Revenue Decline',
    severity: 'HIGH',
    bullishClaim: 'We believe demand for our vehicles remains strong globally, with increasing customer interest across all markets and continued order momentum in key geographies.',
    bearishSignal: 'Automotive revenue decreased by $1.6 billion, or 6%, in the year ended December 31, 2024 compared to the year ended December 31, 2023.',
    magnitude: '6%',
    detectedAt: new Date(Date.now() - 3600000).toISOString(),
    highConfidence: true
  },
  {
    id: 'TSLA-demo-002',
    ticker: 'TSLA',
    filingType: '10-K',
    topic: 'Market Position',
    severity: 'MEDIUM',
    bullishClaim: 'Tesla continues to gain market share in the global electric vehicle market and remains the leader in premium EV segments.',
    bearishSignal: 'Total deliveries decreased 1.1% year over year, representing the first annual delivery decline in the company\'s history.',
    magnitude: '1.1%',
    detectedAt: new Date(Date.now() - 7200000).toISOString(),
    highConfidence: false
  },
  {
    id: 'MSFT-demo-001',
    ticker: 'MSFT',
    filingType: '10-K',
    topic: 'Growth',
    severity: 'LOW',
    bullishClaim: 'Our commercial cloud segment continues to grow rapidly with strong customer adoption across Azure, Microsoft 365, and Dynamics products.',
    bearishSignal: 'Gaming segment revenue decreased $563 million or 5% driven by lower Xbox hardware revenue reflecting market softness.',
    magnitude: '5%',
    detectedAt: new Date(Date.now() - 86400000).toISOString(),
    highConfidence: false
  }
];

const DEMO_METRICS = {
  AAPL: { revenue: { current: 391035000000, prior: 383285000000 }, netIncome: { current: 93736000000, prior: 96995000000 }, assets: { current: 364980000000 }, liabilities: { current: 308030000000 }, operatingCashflow: { current: 118254000000 }, eps: { current: 6.08 } },
  MSFT: { revenue: { current: 245122000000, prior: 211915000000 }, netIncome: { current: 88136000000, prior: 72361000000 }, assets: { current: 512163000000 }, liabilities: { current: 243686000000 }, operatingCashflow: { current: 118548000000 }, eps: { current: 11.80 } },
  NVDA: { revenue: { current: 60922000000, prior: 26974000000 }, netIncome: { current: 29760000000, prior: 4368000000 }, assets: { current: 65728000000 }, liabilities: { current: 22720000000 }, operatingCashflow: { current: 28769000000 }, eps: { current: 11.93 } },
  TSLA: { revenue: { current: 97690000000, prior: 96773000000 }, netIncome: { current: 7090000000, prior: 14999000000 }, assets: { current: 122070000000 }, liabilities: { current: 49016000000 }, operatingCashflow: { current: 14920000000 }, eps: { current: 2.24 } },
};

console.log('Seeding demo data...');

// Add companies
for (const c of DEMO_COMPANIES) {
  db.addToWatchlist({ ...c, status: 'ready', metrics: {
    revenue: DEMO_METRICS[c.ticker]?.revenue?.current,
    netIncome: DEMO_METRICS[c.ticker]?.netIncome?.current,
    eps: DEMO_METRICS[c.ticker]?.eps?.current
  }});
  db.setPrice(c.ticker, DEMO_PRICES[c.ticker]);
  console.log(`  ✓ ${c.ticker} — ${c.companyName}`);
}

// Add filings
for (const f of DEMO_FILINGS) {
  db.addFiling(f);
}
console.log(`  ✓ ${DEMO_FILINGS.length} filings indexed`);

// Add contradictions
for (const c of DEMO_CONTRADICTIONS) {
  db.addContradiction(c);
}
console.log(`  ✓ ${DEMO_CONTRADICTIONS.length} contradictions seeded`);

// Generate notes
for (const c of DEMO_COMPANIES) {
  const filings = db.getFilings(c.ticker);
  const contradictions = db.getContradictions(c.ticker);
  const note = generateResearchNote(c.ticker, c.companyName, DEMO_METRICS[c.ticker], filings, contradictions);
  db.saveNote(note);
}
console.log('  ✓ Research notes generated');

console.log('\nDemo data seeded! Start the server with: node server.js');
