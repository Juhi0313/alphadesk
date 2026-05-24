import { callModel, parseJsonResponse } from '../modelClient.js';
import { BEAR_REVIEWER_SYSTEM, buildBearReviewPrompt } from '../prompts/reviewer.prompt.js';
import { logger } from '../../utils/logger.js';

export async function runBearReviewer({ contradiction, ticker }) {
  logger.info(`[BearReviewer] Reviewing: ${contradiction.topic}`);
  const userPrompt = buildBearReviewPrompt(contradiction, ticker);
  const raw = await callModel({ role: 'reviewer', systemPrompt: BEAR_REVIEWER_SYSTEM, userPrompt, maxTokens: 512 });
  const result = parseJsonResponse(raw);
  return result || { argument: raw.slice(0, 300), strengthens_flag: true, confidence: 0.5, notes: '' };
}
