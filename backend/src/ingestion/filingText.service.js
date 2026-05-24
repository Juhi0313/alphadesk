import { fetchFilingText, resolveFilingUrl } from '../providers/sec.provider.js';
import { updateFilingStatus } from '../db/repositories/filing.repo.js';
import { createHash } from 'crypto';
import { logger } from '../utils/logger.js';

export async function fetchAndStoreFilingText(filing) {
  const url = filing.direct_url || filing.source_url;
  if (!url) return null;

  let resolvedUrl = url;
  if (!url.match(/\.(htm|html|txt)$/i)) {
    resolvedUrl = await resolveFilingUrl(url);
  }

  const text = await fetchFilingText(resolvedUrl);
  if (!text || text.length < 200) {
    logger.warn(`[FilingText] Empty text for filing ${filing.id}`);
    return null;
  }

  const hash = createHash('sha256').update(text).digest('hex').slice(0, 16);
  updateFilingStatus(filing.id, 'text_fetched', { raw_text_hash: hash });

  return { text, hash, url: resolvedUrl };
}

export function extractWorkingSlice(text) {
  // Skip cover page (~3000 chars), read up to 35000 chars to reach Risk Factors / MD&A
  return text.slice(3000, 35000);
}
