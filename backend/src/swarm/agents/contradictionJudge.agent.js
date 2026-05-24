import { callModel, parseJsonResponse } from '../modelClient.js';
import { JUDGE_SYSTEM, buildJudgePrompt } from '../prompts/judge.prompt.js';
import { logger } from '../../utils/logger.js';

export async function runContradictionJudge({ ticker, claims, signals, filingType }) {
  logger.info(`[Judge] Running for ${ticker} with ${claims.length} claims, ${signals.length} signals`);
  if (claims.length === 0 && signals.length === 0) return [];
  const userPrompt = buildJudgePrompt(ticker, claims, signals, filingType);
  const raw = await callModel({ role: 'judge', systemPrompt: JUDGE_SYSTEM, userPrompt, maxTokens: 1024 });
  const contradictions = parseJsonResponse(raw);
  if (!Array.isArray(contradictions)) return [];
  logger.info(`[Judge] Found ${contradictions.length} contradictions for ${ticker}`);
  return contradictions.map(c => ({
    topic: c.topic || 'Unknown',
    bullish_claim: (c.bullish_claim || '').slice(0, 500),
    bearish_signal: (c.bearish_signal || '').slice(0, 500),
    severity: ['HIGH', 'MEDIUM', 'LOW'].includes(c.severity) ? c.severity : 'MEDIUM',
    confidence: Math.min(1, Math.max(0, c.confidence ?? 0.7)),
    magnitude: c.magnitude || ''
  }));
}
