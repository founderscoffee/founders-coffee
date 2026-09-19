import type { LogLevel } from './levels.js';
import type { LogEntry } from './types.js';

export type LogTransport = (entry: LogEntry) => void;

export type BatchTransport = (entries: LogEntry[]) => boolean;

const consoleFor: Record<LogLevel, (line: string) => void> = {
  debug: (line) => console.debug(line),
  info: (line) => console.log(line),
  warn: (line) => console.warn(line),
  error: (line) => console.error(line),
  fatal: (line) => console.error(line),
};

/**
 * Server transport — where everything the product logs ends up (AGENTS.md §5/§13). `no-console`
 * allows `console.*` here, in `tools/` CLI scripts, and at the dev-only OTP/SMS/push providers,
 * which deliberately print a secret this pipeline would redact. Emits one JSON line per entry so
 * Workers Observability / Logpush ingest it as a structured log.
 */
export const consoleTransport: LogTransport = (entry) => {
  consoleFor[entry.level](JSON.stringify(entry));
};

const post = (endpoint: string, payload: string): boolean => {
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.sendBeacon === 'function'
  ) {
    try {
      return navigator.sendBeacon(endpoint, payload);
    } catch {
      return false;
    }
  }
  if (typeof fetch === 'function') {
    fetch(endpoint, { method: 'POST', body: payload }).catch(() => undefined);
    return true;
  }
  return false;
};

/**
 * Build a client transport that ships a BATCH of entries to `endpoint` via
 * `navigator.sendBeacon` (survives page unload), falling back to
 * `fetch(url, { keepalive })`. Guards for SSR / no-`navigator` — never throws.
 * The receiving endpoint is wired per-app (P1-017).
 */
export const createBeaconTransport =
  (endpoint: string): BatchTransport =>
  (entries) =>
    post(endpoint, JSON.stringify({ entries }));
