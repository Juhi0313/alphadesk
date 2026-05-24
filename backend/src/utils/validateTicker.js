const TICKER_RE = /^[A-Z0-9.\-&]{1,15}$/i;

export function validateTicker(ticker) {
  if (!ticker || typeof ticker !== 'string') return { valid: false, error: 'Ticker required' };
  const t = ticker.trim();
  if (t.length === 0) return { valid: false, error: 'Ticker required' };
  if (t.length > 15) return { valid: false, error: 'Ticker too long (max 15 characters)' };
  if (!TICKER_RE.test(t)) return { valid: false, error: 'Invalid ticker format — only A-Z, 0-9, dot, hyphen, ampersand allowed' };
  return { valid: true, ticker: t.toUpperCase() };
}
