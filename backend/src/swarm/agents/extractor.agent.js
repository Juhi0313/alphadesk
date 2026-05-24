import { callModel, parseJsonResponse } from '../modelClient.js';
import { EXTRACTOR_SYSTEM, buildExtractorPrompt } from '../prompts/extractor.prompt.js';
import { saveFacts } from '../../db/repositories/fact.repo.js';
import { logger } from '../../utils/logger.js';

export async function runExtractorAgent({ text, ticker, formType, company_id, filing_id }) {
  logger.info(`[Extractor] Running for ${ticker}`);
  const userPrompt = buildExtractorPrompt(text, ticker, formType);
  const raw = await callModel({ role: 'extractor', systemPrompt: EXTRACTOR_SYSTEM, userPrompt, maxTokens: 1024 });
  const facts = parseJsonResponse(raw);
  if (!Array.isArray(facts)) return [];
  const mapped = facts.map(f => ({
    company_id, filing_id,
    metric: f.metric,
    period: f.period,
    value: f.value,
    unit: f.unit,
    source_type: 'ai_extracted',
    source_locator: f.metric,
    confidence: 0.85
  }));
  if (mapped.length > 0) saveFacts(mapped);
  logger.info(`[Extractor] Extracted ${mapped.length} facts for ${ticker}`);
  return mapped;
}
