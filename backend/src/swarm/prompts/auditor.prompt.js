export const AUDITOR_SYSTEM = `You are a meta-auditor for financial contradiction flags. You review bull and bear arguments and make a final determination. Output valid JSON only.`;

export function buildAuditorPrompt(contradiction, bullReview, bearReview, ticker) {
  return `Make a final audit decision on this contradiction flag for ${ticker}:

CONTRADICTION:
Topic: ${contradiction.topic}
Management claim: "${contradiction.bullish_claim}"
Data signal: "${contradiction.bearish_signal}"
Severity: ${contradiction.severity}

BULL DEFENSE: ${bullReview?.objection || 'None'}
BEAR ARGUMENT: ${bearReview?.argument || 'None'}

Decide: APPROVE or REJECT this flag, and provide a final explanation.

Return JSON:
{
  "decision": "APPROVE|REJECT",
  "final_explanation": "2-3 sentence summary for an analyst",
  "safe_wording": "1 sentence safe for client-facing report",
  "audit_score": 0.0-1.0,
  "adjusted_severity": "HIGH|MEDIUM|LOW"
}`;
}
