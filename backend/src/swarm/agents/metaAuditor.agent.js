import { callModel, parseJsonResponse } from '../modelClient.js';
import { AUDITOR_SYSTEM, buildAuditorPrompt } from '../prompts/auditor.prompt.js';
import { logger } from '../../utils/logger.js';

export async function runMetaAuditor({ contradiction, bullReview, bearReview, ticker }) {
  logger.info(`[MetaAuditor] Auditing: ${contradiction.topic}`);
  const userPrompt = buildAuditorPrompt(contradiction, bullReview, bearReview, ticker);
  const raw = await callModel({ role: 'auditor', systemPrompt: AUDITOR_SYSTEM, userPrompt, maxTokens: 512 });
  const result = parseJsonResponse(raw);
  if (!result) return { decision: 'REJECT', final_explanation: 'Audit parsing failed', safe_wording: '', audit_score: 0.5, adjusted_severity: contradiction.severity };
  return {
    decision: result.decision === 'APPROVE' ? 'APPROVE' : 'REJECT',
    final_explanation: result.final_explanation || '',
    safe_wording: result.safe_wording || '',
    audit_score: Math.min(1, Math.max(0, result.audit_score ?? 0.7)),
    adjusted_severity: ['HIGH', 'MEDIUM', 'LOW'].includes(result.adjusted_severity) ? result.adjusted_severity : contradiction.severity
  };
}
