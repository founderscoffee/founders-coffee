import { z } from 'zod';

import { LOG_LEVELS } from './levels.js';
import { sanitize } from './sanitize.js';
import { consoleTransport, type LogTransport } from './transports.js';
import type { LogEntry } from './types.js';

const MAX_BATCH = 50;
const MAX_MESSAGE = 8_192;
const MAX_STACK = 16_384;
const MAX_LABEL = 128;
const MAX_PATH = 2_048;
const PATHNAME = /^\/[^\s?#]*$/u;

const clientLogEntrySchema = z.looseObject({
  ts: z.iso.datetime(),
  level: z.enum(LOG_LEVELS),
  msg: z.string().max(MAX_MESSAGE),
  service: z.literal('ui'),
  code: z.string().max(MAX_LABEL).optional(),
  stack: z.string().max(MAX_STACK).optional(),
  source: z.string().max(MAX_LABEL).optional(),
  path: z.string().max(MAX_PATH).regex(PATHNAME).optional().catch(undefined),
});

const clientLogBatchSchema = z.object({
  entries: z.array(z.unknown()).max(MAX_BATCH),
});

/**
 * Re-emit what a browser posted to `/client-logs` through the server transport, so UI logs land in
 * the SAME Workers Logs / Logpush stream as server logs (AGENTS.md §13).
 *
 * The body is validated here, as every input is: a batch of at most fifty entries, each one an
 * entry the client logger could have written — an ISO time, a known level, a message, `service`
 * "ui", and text wherever a code, stack or source is given. An entry that is not one is dropped and
 * the rest of its batch kept. Any other field it carries is context, and passes on to be sanitized.
 *
 * `path` is the page the browser was on, as its pathname alone. A path that is anything else —
 * with a query or a fragment, a whole address, or longer than an address can be — is dropped and
 * its report kept, so a query's values never reach the log, even from a browser that sends them.
 *
 * Whatever passes is sanitized again (defense in depth — the client already did).
 */
export const ingestClientLogs = (
  body: unknown,
  transport: LogTransport = consoleTransport,
): void => {
  const batch = clientLogBatchSchema.safeParse(body);
  if (!batch.success) return;
  for (const raw of batch.data.entries) {
    const entry = clientLogEntrySchema.safeParse(raw);
    if (entry.success) transport(sanitize(entry.data) as LogEntry);
  }
};
