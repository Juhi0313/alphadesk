export const WRITER_SYSTEM = `You are a senior financial analyst writing research notes. Write clearly, concisely, and objectively. Always cite specific numbers. Output valid JSON only.`;

export function buildWriterPrompt(ticker, companyName, flags, facts, filingType) {
  const flagSummary = flags.slice(0, 5).map(f => `- [${f.severity}] ${f.topic}: ${f.final_explanation || f.safe_wording}`).join('\n');
  const factSummary = facts.slice(0, 8).map(f => `- ${f.metric}: ${f.value?.toLocaleString()} (${f.change_percent != null ? (f.change_percent > 0 ? '+' : '') + f.change_percent.toFixed(1) + '%' : 'N/A'} YoY)`).join('\n');

  return `Write a research note for ${companyName} (${ticker}) based on their latest ${filingType}.

KEY FINANCIAL METRICS:
${factSummary || 'No metrics extracted'}

CONTRADICTION FLAGS IDENTIFIED:
${flagSummary || 'No contradictions found'}

Return JSON:
{
  "title": "Research Note: ${ticker} - [brief thesis]",
  "executive_summary": "2-3 sentences",
  "key_metrics": [{"label": "...", "value": "...", "trend": "up|down|flat"}],
  "red_flags": [{"topic": "...", "detail": "...", "severity": "HIGH|MEDIUM|LOW"}],
  "bull_case": "paragraph",
  "bear_case": "paragraph",
  "analyst_note": "1-2 sentences with recommendation tone"
}`;
}
