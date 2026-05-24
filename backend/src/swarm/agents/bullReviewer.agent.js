import { callModel, parseJsonResponse } from '../modelClient.js';
import { BULL_REVIEWER_SYSTEM, buildBullReviewPrompt } from '../prompts/reviewer.prompt.js';
import { logger } from '../../utils/logger.js';

export async function runBullReviewer({ contradiction, ticker }) {
  logger.info(`[BullReviewer] Reviewing: ${contradiction.topic}`);
  const userPrompt = buildBullReviewPrompt(contradiction, ticker);
  const raw = await callModel({ role: 'reviewer', systemPrompt: BULL_REVIEWER_SYSTEM, userPrompt, maxTokens: 512 });
  const result = parseJsonResponse(raw);
  return result || { objection: raw.slice(0, 300), weakens_flag: false, confidence: 0.5, notes: '' };
}
