export const JUDGE_SYSTEM = `You are a contradiction judge for financial filings. Your job is to identify specific contradictions between management's optimistic claims and the company's actual financial data. Be precise and evidence-based. Output valid JSON only.`;

export function buildJudgePrompt(ticker, claims, signals, filingType) {
  return `Analyze these findings from ${ticker}'s ${filingType} filing and identify contradictions.

BULLISH CLAIMS from management:
${JSON.stringify(claims.slice(0, 10), null, 2)}

FINANCIAL SIGNALS (from actual data):
${JSON.stringify(signals.slice(0, 10), null, 2)}

For each real contradiction found, return JSON:
[{
  "topic": "short topic label",
  "bullish_claim": "exact management claim text",
  "bearish_signal": "what the data actually shows",
  "severity": "HIGH|MEDIUM|LOW",
  "confidence": 0.0-1.0,
  "magnitude": "quantified impact if possible"
}]

Only include genuine contradictions with clear evidence. Return empty array [] if none found.`;
}
