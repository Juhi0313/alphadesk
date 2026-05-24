export const SCHEMA = `
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  symbol TEXT UNIQUE NOT NULL,
  company_name TEXT,
  country TEXT DEFAULT 'US',
  exchange TEXT,
  cik TEXT,
  bse_code TEXT,
  status TEXT DEFAULT 'loading',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS filings (
  id TEXT PRIMARY KEY,
  company_id TEXT,
  symbol TEXT NOT NULL,
  form_type TEXT,
  filing_date TEXT,
  accession_number TEXT UNIQUE,
  primary_document TEXT,
  source_url TEXT,
  direct_url TEXT,
  raw_text_hash TEXT,
  clean_text_path TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS filing_sections (
  id TEXT PRIMARY KEY,
  filing_id TEXT NOT NULL,
  section_key TEXT NOT NULL,
  section_title TEXT,
  char_start INTEGER,
  char_end INTEGER,
  text_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS financial_facts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  filing_id TEXT,
  metric TEXT NOT NULL,
  period TEXT,
  value REAL,
  prior_value REAL,
  change_percent REAL,
  currency TEXT DEFAULT 'USD',
  unit TEXT,
  source_type TEXT DEFAULT 'xbrl',
  source_locator TEXT,
  confidence REAL DEFAULT 1.0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS narrative_claims (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  filing_id TEXT,
  section_id TEXT,
  claim_type TEXT,
  sentiment TEXT DEFAULT 'positive',
  claim_text TEXT NOT NULL,
  char_start INTEGER,
  char_end INTEGER,
  confidence REAL DEFAULT 0.8,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS financial_signals (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  filing_id TEXT,
  signal_type TEXT NOT NULL,
  metric TEXT,
  direction TEXT DEFAULT 'negative',
  severity TEXT DEFAULT 'MEDIUM',
  description TEXT,
  fact_ids_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contradiction_candidates (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  filing_id TEXT,
  claim_id TEXT,
  signal_id TEXT,
  topic TEXT,
  initial_severity TEXT DEFAULT 'MEDIUM',
  confidence REAL DEFAULT 0.5,
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_reviews (
  id TEXT PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  model_name TEXT,
  review_type TEXT,
  review_text TEXT,
  confidence REAL,
  needs_more_evidence INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS approved_flags (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  filing_id TEXT,
  candidate_id TEXT,
  claim_id TEXT,
  signal_id TEXT,
  ticker TEXT NOT NULL,
  topic TEXT,
  severity TEXT DEFAULT 'MEDIUM',
  bullish_claim TEXT,
  bearish_signal TEXT,
  magnitude TEXT,
  final_explanation TEXT,
  safe_wording TEXT,
  audit_score REAL DEFAULT 0.8,
  bull_objection TEXT,
  bear_argument TEXT,
  ai_generated INTEGER DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS research_notes (
  id TEXT PRIMARY KEY,
  company_id TEXT,
  symbol TEXT NOT NULL,
  title TEXT,
  content_json TEXT NOT NULL,
  generated_from_scan_run_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evidence_edges (
  id TEXT PRIMARY KEY,
  from_type TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_type TEXT NOT NULL,
  to_id TEXT NOT NULL,
  relation_type TEXT,
  confidence REAL DEFAULT 1.0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scan_runs (
  id TEXT PRIMARY KEY,
  company_id TEXT,
  filing_id TEXT,
  symbol TEXT NOT NULL,
  status TEXT DEFAULT 'running',
  started_at TEXT NOT NULL,
  completed_at TEXT,
  error_message TEXT,
  approved_flags_count INTEGER DEFAULT 0,
  rejected_candidates_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  scan_run_id TEXT,
  agent_name TEXT,
  model_name TEXT,
  input_hash TEXT,
  output_hash TEXT,
  status TEXT DEFAULT 'completed',
  error_message TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_filings_symbol ON filings(symbol);
CREATE INDEX IF NOT EXISTS idx_facts_company ON financial_facts(company_id);
CREATE INDEX IF NOT EXISTS idx_claims_company ON narrative_claims(company_id);
CREATE INDEX IF NOT EXISTS idx_signals_company ON financial_signals(company_id);
CREATE INDEX IF NOT EXISTS idx_flags_ticker ON approved_flags(ticker);
CREATE INDEX IF NOT EXISTS idx_scan_runs_symbol ON scan_runs(symbol);

CREATE TABLE IF NOT EXISTS prices (
  id TEXT PRIMARY KEY,
  symbol TEXT UNIQUE NOT NULL,
  price REAL,
  change_pct REAL,
  updated_at TEXT NOT NULL
);
`;
