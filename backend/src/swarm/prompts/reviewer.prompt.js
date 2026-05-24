export const BULL_REVIEWER_SYSTEM = `You are a bull-case advocate reviewing a potential contradiction flag. Your job is to find the strongest COUNTER-ARGUMENT defending management. Be rigorous. Output valid JSON only.`;

export const BEAR_REVIEWER_SYSTEM = `You are a bear-case advocate reviewing a potential contradiction flag. Your job is to STRENGTHEN the case that this is a real contradiction. Be specific and data-driven. Output valid JSON only.`;

export function buildBullReviewPrompt(contradiction, ticker) {
  return `Review this potential contradiction flag for ${ticker}:

Topic: ${contradiction.topic}
Management claim: "${contradiction.bullish_claim}"
Counter-signal: "${contradiction.bearish_signal}"

Provide the strongest bull-case defense. Does context, timing, or industry norms explain this away?

Return JSON:
{"objection": "strongest counter-argument", "weakens_flag": true|false, "confidence": 0.0-1.0, "notes": "brief explanation"}`;
}

export function buildBearReviewPrompt(contradiction, ticker) {
  return `Strengthen the case for this contradiction flag for ${ticker}:

Topic: ${contradiction.topic}
Management claim: "${contradiction.bullish_claim}"
Counter-signal: "${contradiction.bearish_signal}"

What additional context makes this contradiction worse? Any patterns across quarters?

Return JSON:
{"argument": "strongest bear case", "strengthens_flag": true|false, "confidence": 0.0-1.0, "notes": "brief explanation"}`;
}
