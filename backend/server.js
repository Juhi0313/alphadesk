import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { db, initDb } from './db.js';
import { getCIK, getRecentFilings, getCompanyFacts, extractKeyMetrics, fetchFilingText, getStockQuote, getHistoricalPrices, getSubmissions } from './edgar.js';
import { detectContradictions, detectContradictionsNvidia, generateResearchNote } from './contradictions.js';
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

app.get('/api/version', (req, res) => res.json({ v: 'demo-v3', demo: Object.keys({BYND:1}) }));

// ─── WATCHLIST ─────────────────────────────────────────────────────

app.get('/api/watchlist', (req, res) => res.json(db.getWatchlist()));

app.post('/api/watchlist', async (req, res) => {
  const { ticker } = req.body;
  if (!ticker) return res.status(400).json({ error: 'Ticker required' });

  const upper = ticker.toUpperCase().trim();
  if (db.getWatchlist().find(w => w.ticker === upper))
    return res.status(409).json({ error: 'Already in watchlist' });

  // If already known Indian ticker, skip SEC EDGAR entirely
  if (isIndianTicker(upper)) {
    const bseCode = getBSECode(upper);
    const info = bseCode ? await getIndianCompanyInfo(upper) : null;
    const companyName = info?.companyName || upper;
    db.addToWatchlist({ ticker: upper, cik: bseCode || upper, companyName, status: 'loading', exchange: 'BSE/NSE', country: 'IN' });
    broadcast('WATCHLIST_UPDATE', db.getWatchlist());
    res.json({ ticker: upper, companyName, status: 'loading', exchange: 'BSE/NSE' });
    setImmediate(() => fetchIndianCompanyData(upper, bseCode, companyName));
    return;
  }

  // Try SEC EDGAR (US stocks)
  broadcast('STATUS', { message: `Looking up ${upper} on SEC EDGAR...`, ticker: upper });
  const cik = await getCIK(upper);
  if (cik) {
    let companyName = upper;
    try {
      const subs = await getSubmissions(cik);
      companyName = subs?.name || upper;
    } catch(e) {}
    db.addToWatchlist({ ticker: upper, cik, companyName, status: 'loading', exchange: 'NASDAQ/NYSE', country: 'US' });
    broadcast('WATCHLIST_UPDATE', db.getWatchlist());
    res.json({ ticker: upper, cik, companyName, status: 'loading' });
    setImmediate(() => fetchUSCompanyData(upper, cik, companyName));
    return;
  }

  // Not on SEC EDGAR — try NSE/BSE as fallback (handles any Indian ticker)
  broadcast('STATUS', { message: `Not on SEC EDGAR, trying NSE/BSE for ${upper}...`, ticker: upper });
  const indianQuote = await getIndianStockQuote(upper);
  if (indianQuote) {
    db.addToWatchlist({ ticker: upper, cik: upper, companyName: upper, status: 'loading', exchange: indianQuote.exchange || 'BSE/NSE', country: 'IN' });
    broadcast('WATCHLIST_UPDATE', db.getWatchlist());
    res.json({ ticker: upper, companyName: upper, status: 'loading', exchange: 'BSE/NSE' });
    setImmediate(() => fetchIndianCompanyData(upper, null, upper));
    return;
  }

  return res.status(404).json({ error: `${upper} not found on SEC EDGAR, NSE, or BSE. For Indian stocks try TICKER.NS (e.g., OMPOWER.NS)` });
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
  try {
    const ticker = req.params.ticker.toUpperCase();
    const watchItem = db.getWatchlist().find(w => w.ticker === ticker);
    if (!watchItem?.cik) return res.status(404).json({ error: 'Not in watchlist' });

    if (watchItem.country === 'IN') {
      return res.json(watchItem.metrics || {});
    }

    const facts = await getCompanyFacts(watchItem.cik);
    const metrics = facts ? extractKeyMetrics(facts) : {};
    res.json(metrics);
  } catch (e) {
    console.error('metrics error:', e.message);
    res.json({});
  }
});

// ─── RESEARCH NOTE ─────────────────────────────────────────────────

app.get('/api/note/:ticker', async (req, res) => {
  try {
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
  } catch (e) {
    console.error('note error:', e.message);
    res.status(500).json({ error: e.message });
  }
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

const DEMO_SCAN_DATA = {
  BYND: [
    { topic: 'Revenue/Sales', severity: 'HIGH', bullishClaim: 'We believe we are well-positioned to capture the significant long-term opportunity in the plant-based protein market and remain committed to driving growth.', bearishSignal: 'Net revenues decreased approximately 17.9% to $319.8 million for the year ended December 31, 2024, compared to $329.6 million for the prior year.', magnitude: 'Revenue down 17.9%', explanation: 'Management claims strong long-term positioning while revenue has declined for the third consecutive year.' },
    { topic: 'Profitability', severity: 'HIGH', bullishClaim: 'Our strategic initiatives are designed to accelerate growth, improve operational efficiency, and establish a clear pathway to profitability.', bearishSignal: 'We incurred a net loss of $293.6 million for the year ended December 31, 2024, and have incurred net losses since our inception.', magnitude: 'Net loss $293.6M', explanation: 'Pathway to profitability language conflicts with sustained net losses every year since IPO in 2019.' },
    { topic: 'Liquidity', severity: 'CRITICAL', bullishClaim: 'We remain focused on achieving cash flow positive operations and believe our current resources will support our long-term business plan.', bearishSignal: 'We have incurred net losses since inception and had an accumulated deficit of approximately $1.67 billion as of December 31, 2024.', magnitude: 'Accumulated deficit $1.67B', explanation: 'Claims of sufficient resources directly contradict an accumulated deficit exceeding $1.6 billion with no clear profitability timeline.' },
    { topic: 'Demand', severity: 'MEDIUM', bullishClaim: 'We believe consumer demand for plant-based protein alternatives remains strong and that we are well-positioned to benefit as the category continues to develop.', bearishSignal: 'Net revenues decreased in both U.S. retail and U.S. foodservice channels, reflecting lower volume and reduced net revenue per pound sold.', magnitude: 'Volume decline both channels', explanation: 'Management cites strong consumer demand while actual volume declined across every major distribution channel.' },
    { topic: 'Growth', severity: 'HIGH', bullishClaim: 'We continue to invest in our brand, innovation pipeline, and international expansion to drive long-term growth and improve our competitive position in global markets.', bearishSignal: 'Total operating loss was $271.4 million; we reduced headcount and scaled back operational investments to preserve liquidity.', magnitude: 'Operating loss $271.4M', explanation: 'Growth investment narrative conflicts with significant headcount reductions and a $271M operating loss.' }
  ],
  RIVN: [
    { topic: 'Profitability', severity: 'HIGH', bullishClaim: 'We are focused on our path to profitability and believe our technology, vertical integration, and fleet relationships position us to achieve positive gross profit and long-term financial sustainability.', bearishSignal: 'We incurred a net loss of $4.75 billion for the year ended December 31, 2024, and have an accumulated deficit of $17.4 billion since inception.', magnitude: 'Net loss $4.75B', explanation: 'Profitability path claims conflict with a $4.75B annual loss and $17.4B accumulated deficit — the company has never been profitable.' },
    { topic: 'Production/Delivery', severity: 'HIGH', bullishClaim: 'We believe demand for our vehicles remains strong, supported by our commercial fleet partnerships and growing consumer awareness of the Rivian brand.', bearishSignal: 'Production for fiscal year 2024 was approximately 49,476 vehicles, below our initial guidance of 57,000 units — a reduction driven by a component shortage and planned retooling.', magnitude: 'Production missed guidance by ~13%', explanation: 'Strong demand claims are undercut by a significant production shortfall and multiple guidance reductions throughout the year.' },
    { topic: 'Liquidity', severity: 'CRITICAL', bullishClaim: 'We believe our existing cash, cash equivalents, and available-for-sale securities will be sufficient to fund our operations and capital expenditures for at least the next 12 months.', bearishSignal: 'Cash used in operating activities was approximately $5.5 billion for fiscal year 2024; total stockholders equity has been substantially eroded.', magnitude: 'Cash burn $5.5B/year', explanation: 'Liquidity confidence language conflicts with $5.5B annual cash burn — the runway depends entirely on continued capital raises.' },
    { topic: 'Growth', severity: 'MEDIUM', bullishClaim: 'Our strategic partnership with Volkswagen Group and expansion of our commercial fleet business demonstrate strong market validation and create significant incremental growth opportunities.', bearishSignal: 'Revenue for fiscal year 2024 was approximately $4.97 billion, and cost of revenues exceeded revenues, resulting in a gross loss for the year.', magnitude: 'Gross loss on all revenue', explanation: 'Partnership and growth narrative conflicts with selling every vehicle at a loss — gross margin remains deeply negative.' }
  ],
  LCID: [
    { topic: 'Profitability', severity: 'CRITICAL', bullishClaim: 'We believe our best-in-class technology, superior range, and luxury positioning provide a clear path to achieving profitability as we scale production volumes.', bearishSignal: 'Net loss attributable to common stockholders was approximately $2.70 billion for the year ended December 31, 2024; we have never generated a profit.', magnitude: 'Net loss $2.70B', explanation: 'Scale-to-profitability narrative conflicts with producing fewer than 10,000 vehicles annually at a cost-per-unit that far exceeds selling price.' },
    { topic: 'Production/Delivery', severity: 'HIGH', bullishClaim: 'We are ramping production at our Arizona manufacturing facility and remain confident in our ability to grow deliveries and meet the strong demand we see for the Lucid Air and upcoming Gravity SUV.', bearishSignal: 'Lucid produced 9,029 vehicles and delivered 10,241 vehicles in fiscal year 2024 — materially below peer production volumes and initial multi-year targets.', magnitude: 'Production ~9K vs multi-year targets of 50K+', explanation: 'Confidence in production ramp conflicts with volumes that remain a fraction of original guidance and industry comparables.' },
    { topic: 'Liquidity', severity: 'CRITICAL', bullishClaim: 'We believe our cash resources and continued support from our strategic investor will allow us to fund operations and execute on our growth strategy.', bearishSignal: 'Cash used in operations was approximately $2.8 billion; the company depends on ongoing capital injections from the Saudi Public Investment Fund to remain solvent.', magnitude: 'Cash burn $2.8B vs revenue ~$808M', explanation: 'Liquidity assurance relies entirely on sovereign wealth fund bailouts — the company cannot self-fund at current burn rates.' },
    { topic: 'Revenue/Sales', severity: 'HIGH', bullishClaim: 'Customer interest in the Lucid Air remains exceptionally strong, and the upcoming Gravity SUV has generated significant reservation activity and industry acclaim.', bearishSignal: 'Revenue for fiscal year 2024 was approximately $808 million, representing a cost-per-vehicle that implies a loss of over $200,000 on every car delivered.', magnitude: 'Loss >$200K per vehicle', explanation: 'Strong demand language conflicts with unit economics showing the company loses more than the average selling price on every vehicle manufactured.' }
  ],
  SNAP: [
    { topic: 'Revenue/Sales', severity: 'HIGH', bullishClaim: 'We are focused on growing our community, deepening engagement, and building a sustainable advertising business that delivers measurable value to our partners.', bearishSignal: 'Revenue for fiscal year 2024 was $5.36 billion, and we reported a net loss of $698 million; annual revenue growth decelerated significantly from prior years.', magnitude: 'Net loss $698M on $5.36B revenue', explanation: 'Sustainable advertising business claims conflict with persistent net losses and a deceleration in the revenue growth rate that once justified the valuation.' },
    { topic: 'Growth', severity: 'MEDIUM', bullishClaim: 'Daily Active Users grew to 443 million in Q4 2024, reflecting the continued strength of our products and the deep engagement of our community globally.', bearishSignal: 'Despite DAU growth, average revenue per user in North America declined year-over-year as advertisers shifted budgets to competitors with stronger targeting capabilities.', magnitude: 'ARPU decline North America', explanation: 'User growth narrative masks deteriorating monetisation — more users generating less revenue per user signals a structural advertising problem.' },
    { topic: 'Profitability', severity: 'HIGH', bullishClaim: 'We continue to invest in our direct response advertising platform and AI-driven ranking systems which we believe will drive improved monetisation and a path to sustained profitability.', bearishSignal: 'We have incurred net losses every year since inception and had an accumulated deficit of approximately $12.3 billion as of December 31, 2024.', magnitude: 'Accumulated deficit $12.3B', explanation: 'Profitability path language is contradicted by 13 consecutive years of net losses and a $12.3B accumulated deficit with no clear inflection point.' },
    { topic: 'Market Position', severity: 'MEDIUM', bullishClaim: 'Snapchat remains the fastest way to communicate with the people who matter most, and our augmented reality platform is unmatched in scale and capability.', bearishSignal: 'Restructuring charges of $55 million were recorded in fiscal 2024 as the company reduced headcount and reorganised business units to cut costs amid revenue headwinds.', magnitude: 'Restructuring $55M', explanation: 'Market leadership claims conflict with the need to restructure and reduce workforce — indicative of competitive pressure rather than dominance.' }
  ],
  WBD: [
    { topic: 'Profitability', severity: 'HIGH', bullishClaim: 'We are focused on achieving our financial targets, expanding Max globally, and demonstrating that quality content combined with disciplined cost management creates a sustainable and profitable streaming business.', bearishSignal: 'Net loss attributable to Warner Bros. Discovery was approximately $2.3 billion for fiscal year 2024; total debt remains approximately $38 billion following the Discovery merger.', magnitude: 'Net loss $2.3B, debt $38B', explanation: 'Profitability and discipline claims conflict with a $2.3B net loss and debt load that consumes a significant portion of operating cash flow in interest payments.' },
    { topic: 'Growth', severity: 'HIGH', bullishClaim: 'Max reached 116 million subscribers globally in 2024, and we believe our combined sports, news, and entertainment content portfolio positions us to continue growing the platform.', bearishSignal: 'Restructuring and impairment charges exceeded $9 billion since the merger; the company has written down the value of its content library and cable networks multiple times.', magnitude: 'Impairments >$9B post-merger', explanation: 'Subscriber growth narrative is overshadowed by $9B+ in write-downs that signal the combined asset base was significantly overvalued at merger.' },
    { topic: 'Liquidity', severity: 'HIGH', bullishClaim: 'We are committed to deleveraging our balance sheet, reducing total debt by $5 billion, and believe our free cash flow generation supports our financial obligations.', bearishSignal: 'Total long-term debt was approximately $38 billion as of December 31, 2024, with significant maturities due within the next three years requiring refinancing.', magnitude: 'Debt $38B with near-term maturities', explanation: 'Deleveraging commitment conflicts with a debt load that requires constant refinancing and limits strategic flexibility.' },
    { topic: 'Market Position', severity: 'MEDIUM', bullishClaim: 'Our content library — spanning HBO, CNN, DC, Warner Bros. film, and sports rights — represents one of the most valuable and irreplaceable media assets in the world.', bearishSignal: 'Linear network revenues declined double-digits as cable subscribers continue to cut the cord; advertising revenue from traditional TV fell approximately 13% year-over-year.', magnitude: 'Linear TV revenue down ~13%', explanation: 'Claims of irreplaceable asset value conflict with accelerating cord-cutting that is structurally eroding the revenue base that funds content creation.' }
  ],
  PLUG: [
    { topic: 'Liquidity', severity: 'CRITICAL', bullishClaim: 'We are a leading provider of hydrogen fuel cell solutions and believe we are uniquely positioned to benefit from the global transition to green hydrogen and clean energy.', bearishSignal: 'Our independent registered public accounting firm included an explanatory paragraph in their report expressing substantial doubt about our ability to continue as a going concern.', magnitude: 'Going concern warning issued', explanation: 'Green hydrogen leadership claims are directly undercut by an auditor-issued going concern warning — the most severe liquidity red flag in financial reporting.' },
    { topic: 'Revenue/Sales', severity: 'HIGH', bullishClaim: 'We continue to see strong customer demand across our electrolyzer, fuel cell, and liquid hydrogen businesses and are on track to achieve our long-term revenue targets.', bearishSignal: 'Revenue for fiscal year 2024 was approximately $628 million against a cost of revenue of over $1.1 billion, implying a gross loss of nearly $500 million.', magnitude: 'Gross loss ~$500M', explanation: 'Demand and revenue target claims conflict with selling hydrogen products at roughly half their cost — every dollar of revenue destroys value.' },
    { topic: 'Profitability', severity: 'CRITICAL', bullishClaim: 'We are executing on our path to profitability and remain confident that scale, cost reduction initiatives, and government incentives will drive us to positive gross margins.', bearishSignal: 'Net loss for fiscal year 2024 was approximately $1.6 billion; cumulative losses since inception exceed $5 billion with no quarter of profitability on record.', magnitude: 'Net loss $1.6B, cumulative >$5B', explanation: 'Profitability path language has been repeated for years while cumulative losses surpass $5B — the timeline for positive margins keeps receding.' },
    { topic: 'Growth', severity: 'HIGH', bullishClaim: 'Our electrolyzer gigafactory and hydrogen liquefaction network represent transformational infrastructure investments that will drive long-term competitive advantage.', bearishSignal: 'The company raised over $1 billion in equity during 2024 to fund operations, significantly diluting existing shareholders while cash burn remained above $1.5 billion annually.', magnitude: 'Cash burn >$1.5B/year', explanation: 'Infrastructure investment narrative relies on continuous shareholder dilution — growth is funded by selling stock, not by the business generating cash.' }
  ],
  NKLA: [
    { topic: 'Production/Delivery', severity: 'CRITICAL', bullishClaim: 'We remain committed to the commercialisation of our hydrogen fuel cell and battery electric trucks and believe our technology and dealer network position us to serve fleet customers.', bearishSignal: 'Total truck deliveries for fiscal year 2024 were approximately 35 vehicles; the company has delivered fewer than 500 trucks in total since its 2020 SPAC merger.', magnitude: 'Only 35 trucks delivered in FY2024', explanation: 'Commercialisation confidence conflicts with delivering just 35 vehicles in an entire year — a figure indistinguishable from zero at commercial scale.' },
    { topic: 'Liquidity', severity: 'CRITICAL', bullishClaim: 'We are pursuing multiple financing initiatives and strategic alternatives to fund our operations and advance our hydrogen fuelling infrastructure.', bearishSignal: 'The company filed for Chapter 11 bankruptcy protection in February 2025 after exhausting liquidity; total liabilities exceeded total assets by a substantial margin.', magnitude: 'Chapter 11 filed Feb 2025', explanation: 'Financing confidence language directly preceded a bankruptcy filing — the strategic alternatives pursued were insufficient to prevent insolvency.' },
    { topic: 'Market Position', severity: 'HIGH', bullishClaim: 'Nikola is a technology innovator in zero-emission commercial transportation, and we believe our intellectual property and hydrogen ecosystem create significant barriers to entry.', bearishSignal: 'Founder Trevor Milton was convicted on three counts of fraud in 2022 for making false statements about the company\'s technology; multiple SEC and DOJ investigations followed.', magnitude: 'Founder fraud conviction', explanation: 'Technology leadership claims carry heightened credibility risk given the founder\'s criminal fraud conviction for fabricating exactly those technology capabilities.' },
    { topic: 'Growth', severity: 'HIGH', bullishClaim: 'We are building a hydrogen fuelling network across North America that we believe will be a critical enabler for fleet electrification and a source of recurring revenue.', bearishSignal: 'Revenue for fiscal year 2024 was approximately $31 million against operating expenses exceeding $400 million, resulting in a net loss of over $370 million.', magnitude: 'Revenue $31M vs opex $400M+', explanation: 'Hydrogen network growth narrative conflicts with $31M in revenue against $400M+ in costs — the infrastructure buildout has no credible near-term monetisation path.' }
  ],
  AMC: [
    { topic: 'Liquidity', severity: 'HIGH', bullishClaim: 'We believe the box office recovery is well underway and that our strategic actions — including debt refinancing and cost management — have meaningfully strengthened our financial position.', bearishSignal: 'Total debt as of December 31, 2024 was approximately $4.5 billion; interest expense for fiscal year 2024 exceeded $350 million, consuming a substantial portion of operating cash flow.', magnitude: 'Debt $4.5B, interest $350M/year', explanation: 'Financial strengthening claims conflict with $4.5B in debt and $350M annual interest expense that structurally limits any path to genuine deleveraging.' },
    { topic: 'Revenue/Sales', severity: 'MEDIUM', bullishClaim: 'We are encouraged by the performance of theatrical releases and believe the return of major studio content will drive attendance and revenue back toward pre-pandemic levels.', bearishSignal: 'Total revenues for fiscal year 2024 were approximately $4.4 billion, still approximately 15% below 2019 pre-pandemic levels despite a full return of studio content.', magnitude: 'Revenue still 15% below 2019', explanation: 'Recovery optimism conflicts with revenues remaining materially below pre-pandemic levels five years after COVID — structural audience decline is evident.' },
    { topic: 'Profitability', severity: 'HIGH', bullishClaim: 'AMC Entertainment is taking decisive action to return to profitability, and we are confident that our premium large format screens and loyalty programme differentiate us competitively.', bearishSignal: 'Net loss for fiscal year 2024 was approximately $397 million; AMC has reported a net loss every year since 2019 and has issued billions in new equity to stay solvent.', magnitude: 'Net loss $397M, losses every year since 2019', explanation: 'Return to profitability confidence contradicts six consecutive years of net losses and a survival strategy based entirely on equity dilution.' },
    { topic: 'Market Position', severity: 'MEDIUM', bullishClaim: 'Our AMC Stubs loyalty programme has over 30 million members, demonstrating the enduring appeal of the moviegoing experience and the strength of our customer relationships.', bearishSignal: 'Average tickets sold per screen declined year-over-year as streaming alternatives continued to compress theatrical exclusive windows from 90 days to 45 days or less.', magnitude: 'Per-screen attendance declining', explanation: 'Loyalty programme size claims mask declining per-screen productivity — member counts do not offset structural attendance erosion from shortened theatrical windows.' }
  ],
  TLRY: [
    { topic: 'Revenue/Sales', severity: 'MEDIUM', bullishClaim: 'Tilray Brands is the world\'s leading cannabis company, and our diversified platform spanning cannabis, beer, wine, and spirits positions us to deliver sustainable revenue growth globally.', bearishSignal: 'Net revenue for fiscal year 2024 was approximately $789 million, with cannabis revenue declining as U.S. federal legalisation remained stalled and Canadian market pricing compressed.', magnitude: 'Cannabis revenue declining', explanation: 'World leadership claims conflict with declining cannabis revenue in core markets — the diversification into alcohol is acquisition-driven, not organic growth.' },
    { topic: 'Profitability', severity: 'HIGH', bullishClaim: 'We are focused on achieving positive adjusted EBITDA and believe our operational efficiencies, portfolio optimisation, and scale advantages will drive us to sustained profitability.', bearishSignal: 'Net loss for fiscal year 2024 was approximately $347 million; Tilray has never reported a GAAP profit and has accumulated losses exceeding $2.5 billion since inception.', magnitude: 'Net loss $347M, accumulated deficit >$2.5B', explanation: 'Profitability focus language conflicts with $2.5B+ in accumulated losses and a track record of using adjusted metrics to obscure GAAP losses.' },
    { topic: 'Growth', severity: 'MEDIUM', bullishClaim: 'Our acquisition strategy has created a uniquely positioned consumer packaged goods company, and we believe the combination of cannabis and craft alcohol creates significant cross-selling and synergy opportunities.', bearishSignal: 'Goodwill impairment charges of approximately $180 million were recorded in fiscal 2024, reflecting the declining value of previously acquired cannabis assets.', magnitude: 'Goodwill impairment $180M', explanation: 'Acquisition synergy narrative conflicts with $180M in impairments on those same acquisitions — assets bought at a premium are being written down.' },
    { topic: 'Market Position', severity: 'MEDIUM', bullishClaim: 'We are well-positioned for U.S. cannabis legalisation and have built the infrastructure, brands, and distribution capabilities to capture significant market share when federal reform occurs.', bearishSignal: 'U.S. federal cannabis legalisation has not materialised; the DEA rescheduling process remained incomplete as of fiscal year end, and multi-state operators continue to outcompete Tilray in state markets.', magnitude: 'Legalisation catalyst still absent', explanation: 'U.S. legalisation positioning claims have been repeated for four years without the catalyst arriving — meanwhile competitors have built stronger state-level positions.' }
  ],
  OPEN: [
    { topic: 'Market Position', severity: 'HIGH', bullishClaim: 'Opendoor is the leading digital platform for residential real estate, and we believe our technology-driven approach and national scale position us to capture a significant share of the $1.9 trillion U.S. housing market.', bearishSignal: 'Revenue for fiscal year 2024 was approximately $5.1 billion, down from $15.6 billion in fiscal year 2022, as the company dramatically reduced home purchase volumes in response to rising interest rates.', magnitude: 'Revenue down 67% from peak', explanation: 'Market leadership and scale claims conflict with a 67% revenue decline from peak — the business model proved highly vulnerable to the very interest rate environment that persists today.' },
    { topic: 'Profitability', severity: 'HIGH', bullishClaim: 'We are focused on improving our unit economics, reducing contribution loss per home, and executing on our path to Adjusted EBITDA profitability as market conditions normalise.', bearishSignal: 'Net loss for fiscal year 2024 was approximately $392 million; the company has lost over $3 billion since its 2020 IPO and has never reported a GAAP profitable year.', magnitude: 'Net loss $392M, total losses >$3B since IPO', explanation: 'Unit economics improvement narrative has been ongoing for four years while cumulative GAAP losses exceed $3B — normalised market conditions have not produced profitability.' },
    { topic: 'Liquidity', severity: 'MEDIUM', bullishClaim: 'Our asset-light transition and cost reduction initiatives have strengthened our balance sheet, and we believe we have sufficient liquidity to execute our strategy.', bearishSignal: 'Selling, general and administrative expenses remain elevated relative to gross profit; the company continues to burn cash and relies on its revolving credit facility to fund home inventory purchases.', magnitude: 'Continued cash burn', explanation: 'Balance sheet strengthening claims conflict with ongoing cash burn and dependence on credit facilities — the business model requires continuous external financing.' },
    { topic: 'Growth', severity: 'HIGH', bullishClaim: 'We believe the digitisation of real estate transactions is inevitable and that Opendoor\'s platform, data, and brand will enable us to grow transaction volumes and take share from traditional agents.', bearishSignal: 'Homes purchased in fiscal year 2024 declined approximately 40% year-over-year as the company pulled back from markets where spread compression made transactions unprofitable.', magnitude: 'Home purchases down 40% YoY', explanation: 'Inevitable digitisation growth narrative conflicts with the company voluntarily shrinking — volumes declined because the economics do not work at scale in a higher interest rate environment.' }
  ]
};

app.post('/api/scan/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const watchItem = db.getWatchlist().find(w => w.ticker === ticker);
    if (!watchItem) return res.status(404).json({ error: 'Not in watchlist' });

    broadcast('STATUS', { message: `Scanning ${ticker} for contradictions...`, ticker });

    const filings = db.getFilings(ticker);
    const latestAnnual = filings.find(f => f.form === '10-K' || f.form === 'Annual Report');
    const latestFiling = latestAnnual || filings[0];

    let found = [];

    if (process.env.NVIDIA_API_KEY && latestFiling) {
      // AI-powered scan via NVIDIA
      broadcast('STATUS', { message: `Running AI scan on ${ticker}...`, ticker });
      const scanUrl = latestFiling.directUrl || latestFiling.url;
      let text = await fetchFilingText(scanUrl);
      if (text.length < 2000 && scanUrl !== latestFiling.url) text = await fetchFilingText(latestFiling.url);
      const aiResult = await detectContradictionsNvidia(text, ticker, latestFiling.form);
      found = aiResult !== null ? aiResult : detectContradictions(text, ticker, latestFiling.form);
    } else if (DEMO_SCAN_DATA[ticker]) {
      // Use demo data for known tickers
      const now = new Date().toISOString();
      found = DEMO_SCAN_DATA[ticker].map(c => ({
        ...c,
        id: `${ticker}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        ticker, filingType: '10-K', detectedAt: now
      }));
    } else if (latestFiling) {
      const scanUrl = latestFiling.directUrl || latestFiling.url;
      let text = await fetchFilingText(scanUrl);
      if (text.length < 2000 && scanUrl !== latestFiling.url) text = await fetchFilingText(latestFiling.url);
      found = detectContradictions(text, ticker, latestFiling.form);
    }

    db.clearContradictions(ticker);
    for (const c of found) db.addContradiction(c);

    const stored = db.getContradictions(ticker);
    broadcast('CONTRADICTIONS_UPDATE', { ticker, contradictions: stored, count: stored.length });
    res.json({ contradictions: found, count: found.length });
  } catch (e) {
    console.error('scan error:', e.message);
    res.json({ contradictions: [], count: 0, message: e.message });
  }
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
    if (latestAnnual && process.env.NVIDIA_API_KEY) {
      broadcast('STATUS', { message: `Running AI contradiction scan on ${ticker} 10-K...`, ticker });
      const scanUrl = latestAnnual.directUrl || latestAnnual.url;
      let text = await fetchFilingText(scanUrl);
      if (text.length < 2000 && scanUrl !== latestAnnual.url) text = await fetchFilingText(latestAnnual.url);
      if (text) {
        const aiResult = await detectContradictionsNvidia(text, ticker, '10-K');
        const found = aiResult !== null ? aiResult : [];
        db.clearContradictions(ticker);
        for (const c of found) db.addContradiction(c);
        const stored = db.getContradictions(ticker);
        broadcast('CONTRADICTIONS_UPDATE', { ticker, contradictions: stored, count: stored.length });
      }
    } else if (latestAnnual && DEMO_SCAN_DATA[ticker]) {
      const now = new Date().toISOString();
      const found = DEMO_SCAN_DATA[ticker].map(c => ({
        ...c, id: `${ticker}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        ticker, filingType: '10-K', detectedAt: now
      }));
      db.clearContradictions(ticker);
      for (const c of found) db.addContradiction(c);
      const stored = db.getContradictions(ticker);
      broadcast('CONTRADICTIONS_UPDATE', { ticker, contradictions: stored, count: stored.length });
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

    // Get filings from BSE (pass bseCode directly so unknown tickers still get fallback URLs)
    const filings = await getBSEFilings(ticker, bseCode);
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
initDb().then(() => {
  server.listen(PORT, () => {
    console.log(`Analyst Copilot backend running on http://localhost:${PORT}`);
    console.log(`WebSocket ready | US (SEC EDGAR) + India (BSE/NSE) supported`);
  });
});
