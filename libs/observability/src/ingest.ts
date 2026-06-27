import { sanitize } from './sanitize.js';
import { consoleTransport, type LogTransport } from './transports.js';
import type { LogEntry } from './types.js';

/**
 * Re-emit client-forwarded entries through the server transport so UI logs land
 * in the SAME Workers Logs / Logpush stream as server logs (AGENTS.md §13).
 * Sanitizes again server-side (defense in depth — the client already did). The
 * P1-017 `/client-logs` endpoint validates + rate-limits, then calls this.
 */
export const ingestClientLogs = (
  entries: LogEntry[],
  transport: LogTransport = consoleTransport,
): void => {
  for (const raw of entries) {
    transport(sanitize(raw) as LogEntry);
  }
};
