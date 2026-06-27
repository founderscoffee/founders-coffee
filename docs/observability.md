# Observability — centralized logging & metrics

`libs/observability` gives founders.coffee **one logger API for both the UI (browser) and the backend (Cloudflare Workers)**, with every log funneling to a single place, plus product metrics in Analytics Engine. Implements **P0-014** (NFR-7) and **AGENTS.md §13**.

## The two planes

### 1. Application logs (structured lines) → Workers Logs → Logpush

Cloudflare **Workers Observability** captures `console.*` + uncaught exceptions from the Worker. `libs/observability` is the **only sanctioned `console.*` site in the repo** (AGENTS.md §5/§13) — it wraps `console.log` with one structured JSON line per entry.

```
Worker (server-fn / route)   ──console.log(JSON)──▶  Workers Logs (wrangler tail / dashboard)
                                                          │
                                                          ▼  (P0-019)
                                                       Logpush ──▶ R2 / Datadog / …
Browser (UI)                 ──sendBeacon(/client-logs)──▶  Worker ingest ──console──▶  (same stream)
```

The browser cannot reach Workers Logs directly, so **client logs funnel through the Worker**: the client logger buffers entries and beacons a batch to a `/client-logs` endpoint, which calls `ingestClientLogs` to re-emit them through the same server transport — so UI logs land in the **same** stream, tagged `service: 'ui'`.

### 2. Product metrics (counts/sums) → Analytics Engine

A separate binding for product events (events created, RSVPs, density per city/market, payments confirmed) that feed the **P1-019 dashboards**. `createMetrics(env.ANALYTICS)` shapes data points as: `index1` = market, `blob1` = event name, `blob2/3` = city/locale, `doubles` = values.

## API

```ts
import {
  logger,            // isomorphic singleton — same API on Worker + browser
  createServerLogger,
  createClientLogger,
  configureClientLogger,
  createMetrics,
  reportError,
  runWithContext,
} from '@founders-coffee/observability';

// Anywhere (server or client) — the centralized call:
logger.info('event.created', { market: 'DZ', city: 'algiers' });
logger.error('rsvp.failed', { requestId, code: 'event_full' });

// Request-scoped context auto-attached to every log within the scope (AGENTS.md §13).
// P0-012 request middleware wraps each server-fn in this:
const data = runWithContext({ market, locale, userId, requestId }, () => doWork());

// A scoped child logger:
const log = logger.child({ market: 'DZ', requestId });

// Product metrics (server-side, real binding):
const metrics = createMetrics(env.ANALYTICS);
metrics.trackEvent('event_created', { market: 'DZ', city: 'algiers' });
metrics.trackCount('payment_amount', order.total.amount_minor, { market: 'DZ' });

// Error hook (wire into onError / error boundaries / unhandledrejection):
reportError(error, { requestId });
```

### Levels

Threshold is set **programmatically**, not via an env var: `createServerLogger({ level })` / `createClientLogger({ level })` (default `info`). `debug < info < warn < error < fatal`. Apps wanting a custom level pass it at construction; the singleton defaults to `info` (production-appropriate).

### Sanitization

`sanitize()` runs on **both** sides before a log is emitted/forwarded: keys matching `/secret|token|password|otp|authorization|cookie|apikey|privatekey|card|cvv|iban/i` → `[redacted]`, email-shaped values are masked, with depth + circular guards. Secrets never reach Workers Logs / Logpush. Devs must still avoid logging raw user-generated content.

## Wiring status

| Piece | Status |
|---|---|
| `libs/observability` (logger, metrics, ingest, reportError, context, sanitize) | ✅ **P0-014** — complete, 36 Miniflare/pure tests |
| Workers Observability `console.*` capture | ✅ enabled (`observability: { enabled: true }` in each app `wrangler.jsonc`) |
| AsyncLocalStorage request-context propagation | ✅ verified (propagates across awaits under `nodejs_compat`) |
| Client `/client-logs` ingestion endpoint + `configureClientLogger` + `reportError` → `onError`/error boundaries | ⏳ **P1-017** (app wiring; apps are placeholders until then) |
| `ANALYTICS` binding + Logpush destination + dashboard/alerts | ⏳ **P0-019** / **P1-019** (provisioning) |

Until P1-017 wires the endpoint, client logs buffer and flush via beacon to a URL that 404s — fire-and-forget, no crash. The **lib is complete**; only the app-side endpoint is deferred (same pattern as P0-008/P0-009).

## Logpush setup (P0-019)

Workers Trace Events (the `console.*` output this lib emits) are pushed to a destination via **Logpush** (dashboard/API, not code): create a Logpush job for the account-scoped `workers_trace_events` dataset → R2 or a third party (Datadog/Elastic/BigQuery). Whatever Workers Observability captures — including these structured JSON lines — is persisted there. See https://developers.cloudflare.com/logs.
