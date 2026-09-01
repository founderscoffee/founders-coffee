export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

/** Parse an env string into a LogLevel, falling back to `fallback` (default `info`). */
export const parseLogLevel = (
  value: string | undefined,
  fallback: LogLevel = 'info',
): LogLevel => {
  if (!value) return fallback;
  const candidate = value.trim().toLowerCase() as LogLevel;
  return LOG_LEVEL_ORDER[candidate] !== undefined ? candidate : fallback;
};

/** True when `level` is at least as severe as `threshold`. */
export const shouldLog = (level: LogLevel, threshold: LogLevel): boolean =>
  LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[threshold];
