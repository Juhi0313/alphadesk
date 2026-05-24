import { callModel, parseJsonResponse } from '../modelClient.js';
import { CLAIM_MINER_SYSTEM, buildClaimMinerPrompt } from '../prompts/claimMiner.prompt.js';
import { saveClaims } from '../../db/repositories/claim.repo.js';
import { logger } from '../../utils/logger.js';

export async function runClaimMinerAgent({ text, ticker, company_id, filing_id }) {
  logger.info(`[ClaimMiner] Running for ${ticker}`);
  const userPrompt = buildClaimMinerPrompt(text, ticker);
  const raw = await callModel({ role: 'extractor', systemPrompt: CLAIM_MINER_SYSTEM, userPrompt, maxTokens: 1024 });
  const claims = parseJsonResponse(raw);
  if (!Array.isArray(claims)) return [];
  const mapped = claims.map(c => ({
    company_id, filing_id,
    claim_type: c.claim_type || 'bullish_forward',
    sentiment: c.sentiment || 'positive',
    claim_text: (c.claim_text || '').slice(0, 500),
    confidence: c.confidence ?? 0.8
  }));
  if (mapped.length > 0) saveClaims(mapped);
  logger.info(`[ClaimMiner] Mined ${mapped.length} claims for ${ticker}`);
  return mapped;
}
