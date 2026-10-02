import { shouldLog, type LogLevel } from './levels.js';
import { sanitize } from './sanitize.js';
import { createBeaconTransport, type BatchTransport } from './transports.js';
import type { LogContext, LogEntry, LogService, Logger } from './types.js';

const DEFAULT_BUFFER_SIZE = 10;

const isoNow = (): string => new Date().toISOString();

interface GlobalWithDom {
  readonly document?: {
    readonly visibilityState?: string;
    readonly addEventListener: (type: string, listener: () => void) => void;
  };
  readonly window?: {
    readonly addEventListener: (type: string, listener: () => void) => void;
  };
  readonly location?: { readonly pathname?: string };
}

/**
 * The page an entry was logged on, as its pathname alone: never the query or fragment, whose values
 * may be anybody's. Read when the entry is made rather than when its batch is sent, which can be a
 * navigation later. Nothing outside a browser, where there is no page.
 */
const pagePath = (): { readonly path?: string } => {
  const pathname = (globalThis as unknown as GlobalWithDom).location?.pathname;
  return pathname ? { path: pathname } : {};
};

export interface CreateClientLoggerOptions {
  readonly transport?: BatchTransport;
  readonly level?: LogLevel;
  readonly bufferSize?: number;
  readonly service?: LogService;
}

const buildClientLogger = (
  flush: () => void,
  bufferSize: number,
  level: LogLevel,
  transport: BatchTransport,
  service: LogService,
  bound: LogContext,
  buffer: LogEntry[],
): Logger => {
  const push = (
    entryLevel: LogLevel,
    msg: string,
    context?: LogContext,
  ): void => {
    if (!shouldLog(entryLevel, level)) return;
    const merged = sanitize({ ...bound, ...context }) as Record<
      string,
      unknown
    >;
    buffer.push({
      ...merged,
      ...pagePath(),
      ts: isoNow(),
      level: entryLevel,
      msg: sanitize(msg) as string,
      service,
    });
    if (buffer.length >= bufferSize) flush();
  };
  const child = (context: LogContext): Logger =>
    buildClientLogger(
      flush,
      bufferSize,
      level,
      transport,
      service,
      { ...bound, ...context },
      buffer,
    );
  return {
    debug: (msg, context) => push('debug', msg, context),
    info: (msg, context) => push('info', msg, context),
    warn: (msg, context) => push('warn', msg, context),
    error: (msg, context) => push('error', msg, context),
    fatal: (msg, context) => push('fatal', msg, context),
    child,
  };
};

const attachUnloadListeners = (flush: () => void): void => {
  const global = globalThis as unknown as GlobalWithDom;
  global.document?.addEventListener('visibilitychange', () => {
    if (global.document?.visibilityState === 'hidden') flush();
  });
  global.window?.addEventListener('pagehide', flush);
};

/**
 * Create a browser-side logger. Buffers entries and flushes a batch via
 * `transport` (default: a beacon transport) when the buffer fills or on page
 * unload (`visibilitychange`/`pagehide`). Sanitizes before buffering. Best-effort:
 * never throws on transport failure. The receiving endpoint is wired per-app
 * (P1-017).
 */
export const createClientLogger = (
  options: CreateClientLoggerOptions = {},
): Logger => {
  const transport = options.transport ?? createBeaconTransport('/client-logs');
  const level: LogLevel = options.level ?? 'info';
  const bufferSize = options.bufferSize ?? DEFAULT_BUFFER_SIZE;
  const service: LogService = options.service ?? 'ui';
  const buffer: LogEntry[] = [];
  const flush = (): void => {
    if (buffer.length === 0) return;
    const batch = buffer.splice(0, buffer.length);
    transport(batch);
  };
  const logger = buildClientLogger(
    flush,
    bufferSize,
    level,
    transport,
    service,
    {},
    buffer,
  );
  attachUnloadListeners(flush);
  return logger;
};
