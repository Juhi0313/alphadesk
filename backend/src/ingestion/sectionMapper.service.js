import { saveSections } from '../db/repositories/section.repo.js';
import { createHash } from 'crypto';

const SECTION_PATTERNS = [
  { key: 'risk_factors', title: 'Risk Factors', pattern: /item\s+1a[.\s]+risk\s+factors/i },
  { key: 'mda', title: "Management's Discussion and Analysis", pattern: /item\s+7[.\s]+management.{0,30}discussion/i },
  { key: 'business', title: 'Business', pattern: /item\s+1[.\s]+business/i },
  { key: 'financials', title: 'Financial Statements', pattern: /item\s+8[.\s]+financial\s+statements/i },
  { key: 'controls', title: 'Controls and Procedures', pattern: /item\s+9a[.\s]+controls/i },
  { key: 'legal', title: 'Legal Proceedings', pattern: /item\s+3[.\s]+legal\s+proceedings/i },
];

export function mapSections(filing_id, text) {
  const sections = [];
  for (const def of SECTION_PATTERNS) {
    const match = def.pattern.exec(text);
    if (match) {
      const start = match.index;
      const end = Math.min(start + 20000, text.length);
      sections.push({
        filing_id,
        section_key: def.key,
        section_title: def.title,
        char_start: start,
        char_end: end,
        text_hash: createHash('md5').update(text.slice(start, end)).digest('hex').slice(0, 8)
      });
    }
  }
  if (sections.length > 0) saveSections(sections);
  return sections;
}
