import { callModel, parseJsonResponse } from '../modelClient.js';
import { WRITER_SYSTEM, buildWriterPrompt } from '../prompts/writer.prompt.js';
import { saveNote } from '../../db/repositories/note.repo.js';
import { logger } from '../../utils/logger.js';

export async function runNoteWriter({ ticker, companyName, flags, facts, filingType, company_id, scan_run_id }) {
  logger.info(`[NoteWriter] Writing research note for ${ticker}`);
  const userPrompt = buildWriterPrompt(ticker, companyName, flags, facts, filingType);
  const raw = await callModel({ role: 'writer', systemPrompt: WRITER_SYSTEM, userPrompt, maxTokens: 1500 });
  const content = parseJsonResponse(raw);
  if (!content) {
    logger.warn(`[NoteWriter] Failed to parse note for ${ticker}`);
    return null;
  }
  const title = content.title || `Research Note: ${ticker}`;
  const id = saveNote({ company_id, symbol: ticker, title, content_json: content, scan_run_id });
  logger.info(`[NoteWriter] Saved research note ${id} for ${ticker}`);
  return { id, title, content };
}
