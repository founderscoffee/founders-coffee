import { createClientLogger } from './client.js';
import { createServerLogger } from './server.js';
import { createBeaconTransport, type BatchTransport } from './transports.js';
import type { Logger } from './types.js';

/** Endpoint the isomorphic `logger` beacons client logs to; set via {@link configureClientLogger}. */
const clientEndpoint = { current: '/client-logs' };

/** Reads the current endpoint on each flush so late configuration takes effect. */
const dynamicBeacon: BatchTransport = (entries) =>
  createBeaconTransport(clientEndpoint.current)(entries);

const isBrowser =
  typeof (globalThis as { window?: unknown }).window !== 'undefined';

/**
 * Configure the isomorphic `logger`'s client beacon endpoint. Call once at app
 * bootstrap (P1-017) — the transport re-reads the endpoint on each flush, so this
 * works whether called before or after the first client log.
 */
export const configureClientLogger = (config: { endpoint?: string }): void => {
  if (config.endpoint) clientEndpoint.current = config.endpoint;
};

/**
 * The centralized logger — the SAME `.info/.warn/.error/.child` API on Worker and
 * browser (AGENTS.md §13). Server: console transport → Workers Logs → Logpush.
 * Browser: buffers + beacons through the Worker (`/client-logs`, wired P1-017) to
 * the same stream. Created eagerly; module-safe (no Cloudflare bindings held).
 */
export const logger: Logger = isBrowser
  ? createClientLogger({ transport: dynamicBeacon })
  : createServerLogger();
