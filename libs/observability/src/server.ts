import { getRequestContext } from './context.js';
import { shouldLog, type LogLevel } from './levels.js';
import { sanitize } from './sanitize.js';
import { consoleTransport, type LogTransport } from './transports.js';
import type { LogContext, LogEntry, LogService, Logger } from './types.js';

export interface CreateServerLoggerOptions {
  readonly transport?: LogTransport;
  readonly level?: LogLevel;
  readonly service?: LogService;
}

const isoNow = (): string => new Date().toISOString();

const buildLogger = (
  transport: LogTransport,
  threshold: LogLevel,
  service: LogService,
  bound: LogContext,
): Logger => {
  const emit = (level: LogLevel, msg: string, context?: LogContext): void => {
    if (!shouldLog(level, threshold)) return;
    const merged = { ...getRequestContext(), ...bound, ...context };
    const sanitized = sanitize(merged) as Record<string, unknown>;
    const entry: LogEntry = { ...sanitized, ts: isoNow(), level, msg, service };
    transport(entry);
  };
  const child = (context: LogContext): Logger =>
    buildLogger(transport, threshold, service, { ...bound, ...context });
  return {
    debug: (msg, context) => emit('debug', msg, context),
    info: (msg, context) => emit('info', msg, context),
    warn: (msg, context) => emit('warn', msg, context),
    error: (msg, context) => emit('error', msg, context),
    fatal: (msg, context) => emit('fatal', msg, context),
    child,
  };
};

/**
 * Create a server-side logger bound to the Workers runtime. Module-safe — it
 * holds no Cloudflare bindings (context flows via AsyncLocalStorage); create a
 * fresh instance per request only if you need a per-request transport. Defaults:
 * console transport, `info` threshold.
 */
export const createServerLogger = (
  options: CreateServerLoggerOptions = {},
): Logger => {
  const threshold: LogLevel = options.level ?? 'info';
  const transport = options.transport ?? consoleTransport;
  return buildLogger(transport, threshold, options.service ?? 'worker', {});
};
