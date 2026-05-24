export const CLAIM_MINER_SYSTEM = `You are a financial analyst specializing in detecting optimistic and misleading claims in SEC filings. Output valid JSON only.`;

export function buildClaimMinerPrompt(text, ticker) {
  return `Mine narrative claims from this filing for ${ticker}.

Find statements where management expresses:
1. Bullish/optimistic claims about future performance
2. Downplaying of risks
3. Contradictory statements vs actual numbers

Return JSON array:
[{"claim_type": "bullish_forward|risk_downplay|contradiction", "sentiment": "positive|negative", "claim_text": "exact quote max 200 chars", "confidence": 0.0-1.0}]

Text:
${text.slice(3000, 28000)}`;
}
