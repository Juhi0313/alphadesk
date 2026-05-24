const HTML_ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };

export function sanitizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/[&<>"']/g, ch => HTML_ESCAPE[ch])
    .trim();
}

export function sanitizeCompanyName(name) {
  if (!name || typeof name !== 'string') return '';
  return sanitizeText(name).slice(0, 200);
}

export function sanitizeJson(obj) {
  if (typeof obj === 'string') return sanitizeText(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeJson);
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(obj)) result[k] = sanitizeJson(v);
    return result;
  }
  return obj;
}
