import { runExtractorAgent } from './agents/extractor.agent.js';
import { runClaimMinerAgent } from './agents/claimMiner.agent.js';
import { runContradictionJudge } from './agents/contradictionJudge.agent.js';
import { runBullReviewer } from './agents/bullReviewer.agent.js';
import { runBearReviewer } from './agents/bearReviewer.agent.js';
import { runMetaAuditor } from './agents/metaAuditor.agent.js';
import { runNoteWriter } from './agents/noteWriter.agent.js';
import { runSignalEngine } from '../evidence/signalEngine.service.js';
import { extractNarrativeClaims } from '../evidence/claimExtractor.service.js';
import { extractXBRLFacts } from '../evidence/factExtractor.service.js';
import { mapSections } from '../ingestion/sectionMapper.service.js';
import { fetchAndStoreFilingText, extractWorkingSlice } from '../ingestion/filingText.service.js';
import { saveFlag, clearFlags } from '../db/repositories/flag.repo.js';
import { getFacts } from '../db/repositories/fact.repo.js';
import { getClaims } from '../db/repositories/claim.repo.js';
import { getSignals } from '../db/repositories/signal.repo.js';
import { getCompany } from '../db/repositories/company.repo.js';
import { createScanRun, updateScanRun } from '../db/repositories/scanRun.repo.js';
import { saveAuditEvent } from '../db/repositories/audit.repo.js';
import { linkClaimToSignal, linkSignalToFlag } from '../evidence/evidenceGraph.service.js';
import { logger } from '../utils/logger.js';

export async function runSwarm({ ticker, filing, broadcastFn }) {
  const company = getCompany(ticker);
  if (!company) throw new Error(`Company not found: ${ticker}`);

  const scan_run_id = createScanRun({ company_id: company.id, filing_id: filing.id, symbol: ticker });
  const broadcast = broadcastFn || (() => {});
  let approvedCount = 0;
  let rejectedCount = 0;

  try {
    broadcast('SCAN_STATUS', { ticker, scan_run_id, status: 'running', step: 'fetching_text' });

    // 1. Fetch filing text
    const textResult = await fetchAndStoreFilingText(filing);
    if (!textResult) {
      updateScanRun(scan_run_id, { status: 'failed', error_message: 'Could not fetch filing text' });
      broadcast('SCAN_STATUS', { ticker, scan_run_id, status: 'failed', step: 'text_fetch_failed' });
      return { approvedCount: 0, rejectedCount: 0, scan_run_id };
    }
    const { text } = textResult;

    // 2. Map sections
    mapSections(filing.id, text);

    // 3. Extract XBRL facts (US only)
    if (company.country === 'US') {
      broadcast('SCAN_STATUS', { ticker, scan_run_id, status: 'running', step: 'extracting_xbrl' });
      await extractXBRLFacts(ticker, company.id, filing.id);
    }

    // 4. AI fact extraction
    broadcast('SCAN_STATUS', { ticker, scan_run_id, status: 'running', step: 'ai_extraction' });
    await runExtractorAgent({ text, ticker, formType: filing.form_type, company_id: company.id, filing_id: filing.id });

    // 5. Signal engine (deterministic)
    const signals = runSignalEngine(ticker, company.id, filing.id);

    // 6. Narrative claim mining
    broadcast('SCAN_STATUS', { ticker, scan_run_id, status: 'running', step: 'claim_mining' });
    const workingSlice = extractWorkingSlice(text);
    await runClaimMinerAgent({ text: workingSlice, ticker, company_id: company.id, filing_id: filing.id });
    extractNarrativeClaims(workingSlice, company.id, filing.id);

    // 7. Get all evidence
    const facts = getFacts(company.id, filing.id);
    const claims = getClaims(company.id, filing.id);
    const allSignals = getSignals(company.id, filing.id);

    // 8. Contradiction judge
    broadcast('SCAN_STATUS', { ticker, scan_run_id, status: 'running', step: 'contradiction_judge' });
    const contradictions = await runContradictionJudge({
      ticker,
      claims: claims.filter(c => c.sentiment === 'positive'),
      signals: allSignals,
      filingType: filing.form_type
    });

    // 9. Multi-agent review + audit for each contradiction
    clearFlags(ticker);
    broadcast('SCAN_STATUS', { ticker, scan_run_id, status: 'running', step: 'multi_agent_review', total: contradictions.length });

    for (const contradiction of contradictions) {
      try {
        const [bullReview, bearReview] = await Promise.all([
          runBullReviewer({ contradiction, ticker }),
          runBearReviewer({ contradiction, ticker })
        ]);
        const auditResult = await runMetaAuditor({ contradiction, bullReview, bearReview, ticker });

        saveAuditEvent({ scan_run_id, agent_name: 'meta_auditor', model_name: 'qwen/qwen3-4b', status: auditResult.decision === 'APPROVE' ? 'completed' : 'rejected' });

        if (auditResult.decision === 'APPROVE') {
          const flag_id = saveFlag({
            company_id: company.id,
            filing_id: filing.id,
            ticker,
            topic: contradiction.topic,
            severity: auditResult.adjusted_severity,
            bullish_claim: contradiction.bullish_claim,
            bearish_signal: contradiction.bearish_signal,
            magnitude: contradiction.magnitude,
            final_explanation: auditResult.final_explanation,
            safe_wording: auditResult.safe_wording,
            audit_score: auditResult.audit_score,
            bull_objection: bullReview?.objection,
            bear_argument: bearReview?.argument
          });
          approvedCount++;
          broadcast('FLAG_FOUND', { ticker, flag: { topic: contradiction.topic, severity: auditResult.adjusted_severity, safe_wording: auditResult.safe_wording } });
        } else {
          rejectedCount++;
        }
      } catch (e) {
        logger.warn(`[SwarmRunner] Review failed for ${contradiction.topic}`, e.message);
        rejectedCount++;
      }
    }

    // 10. Generate research note
    broadcast('SCAN_STATUS', { ticker, scan_run_id, status: 'running', step: 'writing_note' });
    const approvedFlags = (await import('../db/repositories/flag.repo.js')).getFlags(ticker);
    await runNoteWriter({ ticker, companyName: company.company_name || ticker, flags: approvedFlags, facts, filingType: filing.form_type, company_id: company.id, scan_run_id });

    updateScanRun(scan_run_id, { status: 'completed', approved_flags_count: approvedCount, rejected_candidates_count: rejectedCount });
    broadcast('SCAN_COMPLETE', { ticker, scan_run_id, approved_flags_count: approvedCount, rejected_candidates_count: rejectedCount });

    logger.info(`[SwarmRunner] Complete for ${ticker}: ${approvedCount} flags approved, ${rejectedCount} rejected`);
    return { approvedCount, rejectedCount, scan_run_id };

  } catch (e) {
    logger.error(`[SwarmRunner] Fatal error for ${ticker}`, e.message);
    updateScanRun(scan_run_id, { status: 'failed', error_message: e.message });
    broadcast('SCAN_STATUS', { ticker, scan_run_id, status: 'failed', error: e.message });
    throw e;
  }
}
