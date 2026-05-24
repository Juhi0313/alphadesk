export const EXTRACTOR_SYSTEM = `You are a financial filing analyst. Extract key financial metrics and forward-looking statements from filing text. Output valid JSON only.`;

export function buildExtractorPrompt(text, ticker, formType) {
  return `Extract financial data from this ${formType} filing for ${ticker}.

Return a JSON array of objects with this structure:
[{"metric": "Revenue", "period": "FY2024", "value": 1234567890, "unit": "USD", "context": "brief quote"}]

Include: Revenue, Net Income, EPS, Operating Income, Gross Profit, Total Assets, Long-Term Debt, Cash, Operating Cash Flow.
If a metric is not found, skip it.

Filing text:
${text.slice(3000, 35000)}`;
}
