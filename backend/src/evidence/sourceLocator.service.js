export function locateInText(text, phrase) {
  if (!text || !phrase) return null;
  const idx = text.toLowerCase().indexOf(phrase.toLowerCase());
  if (idx === -1) return null;
  const snippet = text.slice(Math.max(0, idx - 100), idx + phrase.length + 100);
  return { char_start: idx, char_end: idx + phrase.length, snippet };
}

export function buildSourceLocator(fact) {
  return `${fact.source_type}:${fact.source_locator}:${fact.period}`;
}
