import 'server-only';

type Level = 'info' | 'warn' | 'error';

/**
 * Structured JSON logging. Never pass personal data (names, mobiles, emails,
 * tokens) in `fields` — log ids, codes and counts only.
 */
function write(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  // eslint-disable-next-line no-console
  else console.info(line);
}

/** Error summary without payload values (Postgres "details" can contain user input). */
function describe(err: unknown) {
  if (err instanceof Error) return { name: err.name, message: err.message };
  if (err && typeof err === 'object') {
    const e = err as { code?: unknown; message?: unknown };
    return { code: e.code ?? null, message: typeof e.message === 'string' ? e.message : null };
  }
  return { message: String(err ?? '') };
}

export const log = {
  info: (event: string, fields?: Record<string, unknown>) => write('info', event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write('warn', event, fields),
  error: (event: string, err?: unknown, fields?: Record<string, unknown>) =>
    write('error', event, {
      ...fields,
      error: describe(err),
    }),
};
