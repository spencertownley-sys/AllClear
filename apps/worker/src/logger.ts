type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/** Structured JSON logs: one line per event so Railway/Sentry can index them. */
export const log = {
  debug: (msg: string, fields?: Record<string, unknown>) => emit('debug', msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => emit('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit('error', msg, fields),
};

export function errorFields(error: unknown): Record<string, unknown> {
  if (error instanceof Error) return { error: error.message, stack: error.stack?.split('\n').slice(0, 4).join(' | ') };
  return { error: String(error) };
}
