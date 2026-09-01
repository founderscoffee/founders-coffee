import { createClientLogger } from './client.js';
import { createBeaconTransport, type BatchTransport } from './transports.js';
import type { Logger } from './types.js';

const clientEndpoint = { current: '/client-logs' };

/** Reads the current endpoint on each flush so late configuration takes effect. */
const dynamicBeacon: BatchTransport = (entries) =>
  createBeaconTransport(clientEndpoint.current)(entries);

/**
 * Configure the isomorphic `logger`'s client beacon endpoint. Call once at app bootstrap — the
 * transport re-reads the endpoint on each flush, so this works before or after the first client log.
 */
export const configureClientLogger = (config: { endpoint?: string }): void => {
  if (config.endpoint) clientEndpoint.current = config.endpoint;
};

let cachedClient: Logger | null = null;
const clientLogger = (): Logger =>
  (cachedClient ??= createClientLogger({ transport: dynamicBeacon }));

let override: Logger | null = null;
/**
 * Inject the server logger at server bootstrap (see `./server-init.ts`). Kept in this module so
 * `logger.ts` NEVER statically imports `./server.js` (→ `./context.js` → `node:async_hooks`) — that
 * import would leak `AsyncLocalStorage` into the client bundle. Until a server entry imports
 * `server-init`, the active logger falls back to the client beacon logger.
 */
export const setLogger = (next: Logger): void => {
  override = next;
};

const isBrowser =
  typeof (globalThis as { window?: unknown }).window !== 'undefined';

const noopFallback: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined,
  child: () => noopFallback,
};

const resolve = (): Logger =>
  override ?? (isBrowser ? clientLogger() : noopFallback);

export const logger: Logger = new Proxy({} as Logger, {
  get: (_target, prop) => {
    const active = resolve();
    const value = active[prop as keyof Logger];
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(active)
      : value;
  },
});
