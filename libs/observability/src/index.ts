/**
 * founders.coffee centralized observability — one isomorphic logger for UI and
 * backend (AGENTS.md §13). Server logs funnel `console.*` → Workers Logs →
 * Logpush; client logs beacon through the Worker to the same stream. Product
 * metrics go to a separate Analytics Engine binding.
 *
 * Barrel discipline (TanStack Router #2783): the public barrel re-exports ONLY client-safe
 * modules. Server-only modules that import Node built-ins (`context.ts` → `node:async_hooks`)
 * are imported directly from their server-only consumers — never re-exported here — so Vite's
 * client bundle cannot pull `AsyncLocalStorage` into the browser.
 */
export * from './levels.js';
export * from './types.js';
export { sanitize } from './sanitize.js';
export {
  consoleTransport,
  createBeaconTransport,
  type LogTransport,
  type BatchTransport,
} from './transports.js';
export {
  createMetrics,
  buildDataPoint,
  type MetricDimensions,
  type Metrics,
} from './metrics.js';
export { ingestClientLogs } from './ingest.js';
export { createClientLogger, type CreateClientLoggerOptions } from './client.js';
export { logger, configureClientLogger, setLogger } from './logger.js';
export { reportError } from './report.js';
export type { RequestContext } from './context.js';
