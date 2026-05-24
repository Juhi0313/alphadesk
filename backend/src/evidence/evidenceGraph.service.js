import { getSqlite } from '../db/db.js';
import { randomUUID } from 'crypto';

export function linkEvidence({ from_type, from_id, to_type, to_id, relation_type, confidence = 1.0 }) {
  const db = getSqlite();
  const now = new Date().toISOString();
  db.prepare(`INSERT OR IGNORE INTO evidence_edges (id,from_type,from_id,to_type,to_id,relation_type,confidence,created_at) VALUES (?,?,?,?,?,?,?,?)`)
    .run(randomUUID(), from_type, from_id, to_type, to_id, relation_type, confidence, now);
}

export function getEvidenceChain(to_type, to_id) {
  return getSqlite().prepare('SELECT * FROM evidence_edges WHERE to_type=? AND to_id=?').all(to_type, to_id);
}

export function linkClaimToSignal(claim_id, signal_id, confidence = 0.8) {
  linkEvidence({ from_type: 'claim', from_id: claim_id, to_type: 'signal', to_id: signal_id, relation_type: 'contradicts', confidence });
}

export function linkSignalToFlag(signal_id, flag_id) {
  linkEvidence({ from_type: 'signal', from_id: signal_id, to_type: 'flag', to_id: flag_id, relation_type: 'supports', confidence: 1.0 });
}
