import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { db } from './db.js';
import { getCIK, getRecentFilings, getCompanyFacts, extractKeyMetrics, fetchFilingText, getStockQuote, getHistoricalPrices, getSubmissions } from './edgar.js';
import { detectContradictions, generateResearchNote } from './contradictions.js';
import { isIndianTicker, getBSECode, getIndianStockQuote, getIndianHistoricalPrices, getBSEFilings, getIndianCompanyInfo } from './india.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../frontend')));

const clients = new Set();

function broadcast(type, data) {
  const msg = JSON.stringify({ type, data, timestamp: Date.now() });
  for (const client of clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({
    type: 'INIT',
    data: {
      watchlist: db.getWatchlist(),
      filings: db.getFilings(),
      contradictions: db.getContradictions()
    }
  }));
  ws.on('close', () => clients.delete(ws));
});

// ─── WATCHLIST ─────────────────────────────────────────────────────

app.get('/api/watchlist', (req, res) => res.json(db.getWatchlist()));

app.post('/api/watchlist', async (req, res) => {
  const { ticker } = req.body;
  if (!ticker) return res.status(400).json({ error: 'Ticker required' });

  const upper = ticker.toUpperCase().trim();
  if (db.getWatchlist().find(w => w.ticker === upper))
    return res.status(409).json({ error: 'Already in watchlist' });

  const indian = isIndianTicker(upper);
  broadcast('STATUS', { message: `Looking up ${upper} on ${indian ? 'BSE/NSE' : 'SEC EDGAR'}...`, ticker: upper });

  if (indian) {
    // Indian stock flow
    const bseCode = getBSECode(upper);
    if (!bseCode) return res.status(404).json({ error: `${upper} not found. Try adding .NS suffix or check the ticker.` });

    const info = await getIndianCompanyInfo(upper);
    const companyName = info?.companyName || upper;

    db.addToWatchlist({ ticker: upper, cik: bseCode, companyName, status: 'loading', exchange: 'BSE/NSE', country: 'IN' });
    broadcast('WATCHLIST_UPDATE', db.getWatchlist());
    res.json({ ticker: upper, companyName, status: 'loading', exchange: 'BSE/NSE' });
    setImmediate(() => fetchIndianCompanyData(upper, bseCode, companyName));
  } else {
    // US stock flow
    const cik = await getCIK(upper);
    if (!cik) return res.status(404).json({ error: `Could not find ${upper} on SEC EDGAR` });

    let companyName = upper;
    try {
      const subs = await getSubmissions(cik);
      companyName = subs?.name || upper;
    } catch(e) {}

    db.addToWatchlist({ ticker: upper, cik, companyName, status: 'loading', exchange: 'NASDAQ/NYSE', country: 'US' });
    broadcast('WATCHLIST_UPDATE', db.getWatchlist());
    res.json({ ticker: upper, cik, companyName, status: 'loading' });
    setImmediate(() => fetchUSCompanyData(upper, cik, companyName));
  }
});

app.delete('/api/watchlist/:ticker', (req, res) => {
  db.removeFromWatchlist(req.params.ticker.toUpperCase());
  broadcast('WATCHLIST_UPDATE', db.getWatchlist());
  res.json({ ok: true });
});

// ─── FILINGS ───────────────────────────────────────────────────────

app.get('/api/filings/:ticker', (req, res) => {
  res.json(db.getFilings(req.params.ticker.toUpperCase()));
});

// ─── CONTRADICTIONS ────────────────────────────────────────────────

app.get('/api/contradictions/:ticker?', (req, res) => {
  res.json(db.getContradictions(req.params.ticker?.toUpperCase()));
});

// ─── QUOTES ────────────────────────────────────────────────────────

app.get('/api/quote/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const indian = isIndianTicker(ticker);
  const quote = indian ? await getIndianStockQuote(ticker) : await getStockQuote(ticker);
  if (quote) db.setPrice(ticker, quote);
  res.json(quote || db.getPrice(ticker) || { error: 'Quote unavailable' });
});

app.get('/api/history/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const days = parseInt(req.query.days) || 30;
  const indian = isIndianTicker(ticker);
  const prices = indian
    ? await getIndianHistoricalPrices(ticker, days)
    : await getHistoricalPrices(ticker, days);
  res.json(prices);
});

// ─── METRICS ───────────────────────────────────────────────────────

app.get('/api/metrics/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const watchItem = db.getWatchlist().find(w => w.ticker === ticker);
  if (!watchItem?.cik) return res.status(404).json({ error: 'Not in watchlist' });

  if (watchItem.country === 'IN') {
    // Return stored metrics for Indian stocks
    return res.json(watchItem.metrics || {});
  }

  const facts = await getCompanyFacts(watchItem.cik);
  const metrics = facts ? extractKeyMetrics(facts) : {};
  res.json(metrics);
});

// ─── RESEARCH NOTE ─────────────────────────────────────────────────

app.get('/api/note/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const existing = db.getNotes(ticker)[0];
  if (existing) return res.json(existing);

  const watchItem = db.getWatchlist().find(w => w.ticker === ticker);
  if (!watchItem) return res.status(404).json({ error: 'Not in watchlist' });

  let metrics = {};
  if (watchItem.country !== 'IN') {
    const facts = await getCompanyFacts(watchItem.cik);
    metrics = facts ? extractKeyMetrics(facts) : {};
  } else {
    metrics = watchItem.metrics || {};
  }

  const filings = db.getFilings(ticker);
  const contradictions = db.getContradictions(ticker);
  const note = generateResearchNote(ticker, watchItem.companyName, metrics, filings, contradictions, watchItem);
  db.saveNote(note);
  res.json(note);
});

app.post('/api/note/:ticker/regenerate', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const watchItem = db.getWatchlist().find(w => w.ticker === ticker);
  if (!watchItem) return res.status(404).json({ error: 'Not in watchlist' });

  let metrics = {};
  if (watchItem.country !== 'IN') {
    const facts = await getCompanyFacts(watchItem.cik);
    metrics = facts ? extractKeyMetrics(facts) : {};
  }

  const filings = db.getFilings(ticker);
  const contradictions = db.getContradictions(ticker);
  const note = generateResearchNote(ticker, watchItem.companyName, metrics, filings, contradictions, watchItem);
  db.saveNote(note);
  broadcast('NOTE_UPDATE', { ticker, note });
  res.json(note);
});

// ─── SCAN ──────────────────────────────────────────────────────────

app.post('/api/scan/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const watchItem = db.getWatchlist().find(w => w.ticker === ticker);
  if (!watchItem) return res.status(404).json({ error: 'Not in watchlist' });

  const filings = db.getFilings(ticker);
  const latestAnnual = filings.find(f => f.form === '10-K' || f.form === 'Annual Report');
  const latestFiling = latestAnnual || filings[0];
  if (!latestFiling) return res.json({ contradictions: [], message: 'No filings found' });

  broadcast('STATUS', { message: `Scanning ${ticker} for contradictions...`, ticker });

  const text = await fetchFilingText(latestFiling.url);
  const found = detectContradictions(text, ticker, latestFiling.form);

  db.clearContradictions(ticker);
  for (const c of found) db.addContradiction(c);

  const stored = db.getContradictions(ticker);
  broadcast('CONTRADICTIONS_UPDATE', { ticker, contradictions: stored, count: stored.length });
  res.json({ contradictions: found, count: found.length });
});

// ─── DASHBOARD ─────────────────────────────────────────────────────

app.get('/api/dashboard', (req, res) => {
  const watchlist = db.getWatchlist();
  const allContradictions = db.getContradictions();
  const allFilings = db.getFilings();
  res.json({
    watchlist,
    totalFilings: allFilings.length,
    totalContradictions: allContradictions.length,
    highSeverityFlags: allContradictions.filter(c => c.severity === 'HIGH' || c.severity === 'CRITICAL').length,
    recentFilings: allFilings.sort((a, b) => new Date(b.filingDate) - new Date(a.filingDate)).slice(0, 10)
  });
});

// ─── US COMPANY FETCH ──────────────────────────────────────────────

async function fetchUSCompanyData(ticker, cik, companyName) {
  try {
    broadcast('STATUS', { message: `Fetching SEC filings for ${ticker}...`, ticker });
    const filings = await getRecentFilings(cik, ticker);
    for (const f of filings) db.addFiling(f);
    if (filings.length) broadcast('FILINGS_UPDATE', { ticker, filings: db.getFilings(ticker) });

    const quote = await getStockQuote(ticker);
    if (quote) { db.setPrice(ticker, quote); broadcast('PRICE_UPDATE', { ticker, quote }); }

    broadcast('STATUS', { message: `Processing financial data for ${ticker}...`, ticker });
    const facts = await getCompanyFacts(cik);
    const metrics = facts ? extractKeyMetrics(facts) : {};

    const wl = db.getWatchlist();
    const item = wl.find(w => w.ticker === ticker);
    if (item) {
      item.status = 'ready';
      item.metrics = { revenue: metrics?.revenue?.current, netIncome: metrics?.netIncome?.current, eps: metrics?.eps?.current };
      db.save();
      broadcast('WATCHLIST_UPDATE', db.getWatchlist());
    }

    const latestAnnual = filings.find(f => f.form === '10-K');
    if (latestAnnual) {
      broadcast('STATUS', { message: `Running contradiction scan on ${ticker} 10-K...`, ticker });
      const text = await fetchFilingText(latestAnnual.url);
      if (text) {
        const found = detectContradictions(text, ticker, '10-K');
        db.clearContradictions(ticker);
        for (const c of found) db.addContradiction(c);
        const stored = db.getContradictions(ticker);
        broadcast('CONTRADICTIONS_UPDATE', { ticker, contradictions: stored, count: stored.length });
      }
    }

    broadcast('STATUS', { message: `${ticker} fully loaded`, ticker, done: true });
  } catch(e) {
    console.error(`[${ticker}] Error:`, e.message);
    broadcast('STATUS', { message: `Error loading ${ticker}: ${e.message}`, ticker, error: true });
  }
}

// ─── INDIAN COMPANY FETCH ──────────────────────────────────────────

async function fetchIndianCompanyData(ticker, bseCode, companyName) {
  try {
    broadcast('STATUS', { message: `Fetching BSE/NSE filings for ${ticker}...`, ticker });

    // Get filings from BSE
    const filings = await getBSEFilings(ticker);
    for (const f of filings) db.addFiling(f);
    if (filings.length) broadcast('FILINGS_UPDATE', { ticker, filings: db.getFilings(ticker) });

    // Get live price from Yahoo Finance (NSE)
    broadcast('STATUS', { message: `Fetching ${ticker} price from NSE...`, ticker });
    const quote = await getIndianStockQuote(ticker);
    if (quote) { db.setPrice(ticker, quote); broadcast('PRICE_UPDATE', { ticker, quote }); }

    // Update watchlist status
    const wl = db.getWatchlist();
    const item = wl.find(w => w.ticker === ticker);
    if (item) {
      item.status = 'ready';
      item.companyName = companyName;
      if (quote) {
        item.metrics = {
          marketCap: quote.marketCap,
          price: quote.price,
          currency: 'INR'
        };
      }
      db.save();
      broadcast('WATCHLIST_UPDATE', db.getWatchlist());
    }

    // Try to scan annual report for contradictions
    const annualFiling = filings.find(f => f.form === 'Annual Report');
    if (annualFiling) {
      broadcast('STATUS', { message: `Scanning ${ticker} Annual Report...`, ticker });
      try {
        const text = await fetchFilingText(annualFiling.url);
        if (text && text.length > 500) {
          const found = detectContradictions(text, ticker, 'Annual Report');
          db.clearContradictions(ticker);
          for (const c of found) db.addContradiction(c);
          const stored = db.getContradictions(ticker);
          broadcast('CONTRADICTIONS_UPDATE', { ticker, contradictions: stored, count: stored.length });
        }
      } catch(e) {}
    }

    broadcast('STATUS', { message: `${ticker} fully loaded (BSE/NSE)`, ticker, done: true });
    console.log(`[${ticker}] Indian stock loaded.`);
  } catch(e) {
    console.error(`[${ticker}] Indian fetch error:`, e.message);
    broadcast('STATUS', { message: `Error loading ${ticker}: ${e.message}`, ticker, error: true });
  }
}

// ─── PRICE POLLING (every 60s) ────────────────────────────────────

setInterval(async () => {
  const watchlist = db.getWatchlist().filter(w => w.status === 'ready');
  for (const item of watchlist) {
    try {
      const quote = item.country === 'IN'
        ? await getIndianStockQuote(item.ticker)
        : await getStockQuote(item.ticker);
      if (quote) {
        db.setPrice(item.ticker, quote);
        broadcast('PRICE_UPDATE', { ticker: item.ticker, quote });
      }
    } catch(e) {}
    await new Promise(r => setTimeout(r, 2000));
  }
}, 60000);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Analyst Copilot backend running on http://localhost:${PORT}`);
  console.log(`WebSocket ready | US (SEC EDGAR) + India (BSE/NSE) supported`);
});
