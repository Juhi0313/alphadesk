import { getFacts } from '../db/repositories/fact.repo.js';
import { saveSignals } from '../db/repositories/signal.repo.js';
import { logger } from '../utils/logger.js';

const THRESHOLDS = {
  revenue_decline: -0.05,
  margin_squeeze: -0.03,
  debt_surge: 0.20,
  cash_burn: -0.30,
};

export function runSignalEngine(ticker, company_id, filing_id) {
  const facts = getFacts(company_id, filing_id);
  const signals = [];

  const byMetric = {};
  for (const f of facts) byMetric[f.metric] = f;

  const revenue = byMetric['Revenue'];
  if (revenue?.change_percent != null && revenue.change_percent < THRESHOLDS.revenue_decline * 100) {
    signals.push({
      company_id, filing_id,
      signal_type: 'revenue_decline',
      metric: 'Revenue',
      direction: 'negative',
      severity: revenue.change_percent < -15 ? 'HIGH' : 'MEDIUM',
      description: `Revenue declined ${revenue.change_percent.toFixed(1)}% YoY`,
      fact_ids: [revenue.id]
    });
  }

  const debt = byMetric['Long-Term Debt'];
  if (debt?.change_percent != null && debt.change_percent > THRESHOLDS.debt_surge * 100) {
    signals.push({
      company_id, filing_id,
      signal_type: 'debt_surge',
      metric: 'Long-Term Debt',
      direction: 'negative',
      severity: debt.change_percent > 50 ? 'HIGH' : 'MEDIUM',
      description: `Long-term debt increased ${debt.change_percent.toFixed(1)}% YoY`,
      fact_ids: [debt.id]
    });
  }

  const cash = byMetric['Cash'];
  if (cash?.change_percent != null && cash.change_percent < THRESHOLDS.cash_burn * 100) {
    signals.push({
      company_id, filing_id,
      signal_type: 'cash_burn',
      metric: 'Cash',
      direction: 'negative',
      severity: cash.change_percent < -50 ? 'HIGH' : 'MEDIUM',
      description: `Cash position declined ${cash.change_percent.toFixed(1)}% YoY`,
      fact_ids: [cash.id]
    });
  }

  if (signals.length > 0) saveSignals(signals);
  logger.info(`[SignalEngine] Generated ${signals.length} signals for ${ticker}`);
  return signals;
}
