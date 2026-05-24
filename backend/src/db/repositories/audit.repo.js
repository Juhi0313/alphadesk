import { getSqlite } from '../db.js';
import { randomUUID } from 'crypto';

export function saveAuditEvent({ scan_run_id, agent_name, model_name, input_hash, output_hash, status = 'completed', error_message }) {
  const db = getSqlite();
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO audit_events (id,scan_run_id,agent_name,model_name,input_hash,output_hash,status,error_message,created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(id, scan_run_id, agent_name, model_name, input_hash, output_hash, status, error_message, now);
  return id;
}

export function getAuditEvents(scan_run_id) {
  return getSqlite().prepare('SELECT * FROM audit_events WHERE scan_run_id=? ORDER BY created_at').all(scan_run_id);
}
