import { saveClaims } from '../db/repositories/claim.repo.js';
import { logger } from '../utils/logger.js';

const BULLISH_PATTERNS = [
  /(?:record|strong|exceptional|robust|significant)\s+(?:revenue|growth|performance|results)/gi,
  /(?:increased|grew|expanded|improved)\s+(?:revenue|margin|profit|income|sales)\s+by\s+[\d.]+%/gi,
  /(?:well-positioned|on track|confident|optimistic)\s+(?:to|for|about)/gi,
  /(?:growing|expanding)\s+(?:market share|customer base|pipeline)/gi,
];

const BEARISH_PATTERNS = [
  /(?:declined|decreased|fell|dropped)\s+(?:revenue|margin|profit|income)\s+by\s+[\d.]+%/gi,
  /(?:challenging|difficult|adverse|unfavorable)\s+(?:market|conditions|environment)/gi,
  /(?:significant|material|substantial)\s+(?:risk|uncertainty|concern|exposure)/gi,
  /(?:going concern|substantial doubt|ability to continue)/gi,
  /(?:impairment|write-?down|restructuring|layoff|headcount reduction)/gi,
];

export function extractNarrativeClaims(text, company_id, filing_id) {
  const claims = [];
  let offset = 0;

  for (const pattern of BULLISH_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      claims.push({
        company_id,
        filing_id,
        claim_type: 'bullish_forward',
        sentiment: 'positive',
        claim_text: match[0].slice(0, 300),
        char_start: match.index,
        char_end: match.index + match[0].length,
        confidence: 0.75
      });
    }
  }

  for (const pattern of BEARISH_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      claims.push({
        company_id,
        filing_id,
        claim_type: 'risk_disclosure',
        sentiment: 'negative',
        claim_text: match[0].slice(0, 300),
        char_start: match.index,
        char_end: match.index + match[0].length,
        confidence: 0.8
      });
    }
  }

  if (claims.length > 0) saveClaims(claims);
  logger.info(`[ClaimExtractor] Extracted ${claims.length} narrative claims`);
  return claims;
}
