# ALPHA■DESK — Analyst Copilot
Bloomberg Terminal-style financial analyst copilot

## 🚀 Quick Start

### 1. Start the backend
```bash
cd backend
node server.js
```
Backend runs on http://localhost:3001

### 2. Open the frontend
Open `frontend/index.html` in your browser directly (no build step needed)
OR serve it:
```bash
cd frontend
npx serve .
```

## 💡 How to Use

1. **Add companies** — Type a ticker (e.g. `AAPL`, `MSFT`, `NVDA`) in the top bar and click `+ WATCH`
2. **Wait for data** — The backend auto-fetches from SEC EDGAR (free, no API key)
3. **View dashboard** — See live prices, filing counts, contradiction flags
4. **Run a scan** — Click ⚡ SCAN on any company to run the contradiction engine
5. **View flags** — Go to FLAGS tab to see narrative contradictions detected
6. **Generate note** — Go to RESEARCH NOTE to get a structured analysis

## 🔧 Architecture

```
frontend/index.html     ← Single-file React-less frontend
backend/
  server.js             ← Express + WebSocket server
  edgar.js              ← SEC EDGAR API client (free)
  contradictions.js     ← Pattern-matching contradiction engine
  db.js                 ← JSON-based local storage (no SQL needed)
  data.json             ← Auto-created, persists watchlist/filings
```

## 📡 Free APIs Used
- **SEC EDGAR** — All 10-K, 10-Q, 8-K filings (completely free, no auth)
- **SEC XBRL API** — Structured financial data (free)
- **Yahoo Finance** — Stock quotes & price history (free, no key)

## ⚡ Real-time Features
- WebSocket for live price updates (polls every 60s)
- Auto-ingests new filings when companies are added
- Contradiction scan runs automatically on 10-K filings
- Live ticker tape at the top

## 🔍 Contradiction Engine
Pattern-based NLP that compares:
- Bullish management language ("demand remains strong")
- Against negative financial signals in the same document
- Severity: CRITICAL / HIGH / MEDIUM / LOW
- No AI API needed — pure regex + heuristics

## 🎮 Quick Demo (No Internet Needed)

Seed realistic demo data (AAPL, MSFT, NVDA, TSLA with real financials + contradictions):
```bash
cd backend
node seed-demo.js
node server.js
```
Then open `frontend/index.html`

## 📁 File Structure
```
analyst-copilot/
├── README.md
├── start.sh
├── backend/
│   ├── package.json
│   ├── server.js          ← Express + WebSocket
│   ├── edgar.js           ← SEC EDGAR free API client
│   ├── contradictions.js  ← Pattern-matching NLP engine
│   ├── db.js              ← JSON persistent storage
│   ├── seed-demo.js       ← Demo data seeder
│   └── data.json          ← Auto-created database
└── frontend/
    └── index.html         ← Complete single-file UI
```
