export function log(level, msg, meta) {
  const ts = new Date().toISOString();
  const base = `[${level.toUpperCase()}][${ts}] ${msg}`;
  if (meta) console.log(base, '|', typeof meta === 'string' ? meta : JSON.stringify(meta));
  else console.log(base);
}

export const logger = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta)
};
