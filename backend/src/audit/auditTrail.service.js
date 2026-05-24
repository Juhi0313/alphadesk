import { createHash } from 'crypto';
import { saveAuditEvent, getAuditEvents } from '../db/repositories/audit.repo.js';

export function hashContent(content) {
  const str = typeof content === 'string' ? content : JSON.stringify(content);
  return createHash('sha256').update(str).digest('hex').slice(0, 16);
}

export async function auditedAgentCall({ scan_run_id, agent_name, model_name, input, callFn }) {
  const input_hash = hashContent(input);
  let output, output_hash, status = 'completed', error_message;
  try {
    output = await callFn();
    output_hash = hashContent(output);
  } catch (e) {
    status = 'failed';
    error_message = e.message;
    output_hash = 'error';
    throw e;
  } finally {
    saveAuditEvent({ scan_run_id, agent_name, model_name, input_hash, output_hash, status, error_message });
  }
  return output;
}

export function getAuditTrail(scan_run_id) {
  return getAuditEvents(scan_run_id);
}
