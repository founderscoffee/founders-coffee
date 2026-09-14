# Observability — centralized logging & metrics

`libs/observability` gives founders.coffee **one logger API for both the UI (browser) and the backend (Cloudflare Workers)**, with every log funneling to a single place, plus product metrics in Analytics Engine. Implements **P0-014** (NFR-7) and **AGENTS.md §13**.

For the [community-building release](./release-strategy.md), product dashboards prioritize events
created/completed, RSVPs, cancellations/no-shows, repeat participation, recurring hosts, and density
by city/market. Payment and sponsor metrics are retained only as future examples.

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

A separate binding for community product events (events created/completed, RSVPs, repeat
participation, recurring hosts, and density per city/market) feeds the **P1-019 dashboards**.
`createMetrics(env.ANALYTICS)` shapes data points as: `index1` = market, `blob1` = event name,
`blob2/3` = city/locale, `doubles` = values. Payment metrics become relevant only if a future
commercial phase is explicitly opened.

## API

```ts
import {
  logger, // isomorphic singleton — same API on Worker + browser
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
metrics.trackCount('repeat_participant', 1, { market: 'DZ', city: 'algiers' });

// Error hook (wire into onError / error boundaries / unhandledrejection):
reportError(error, { requestId });
```

### Levels

Threshold is set **programmatically**, not via an env var: `createServerLogger({ level })` / `createClientLogger({ level })` (default `info`). `debug < info < warn < error < fatal`. Apps wanting a custom level pass it at construction; the singleton defaults to `info` (production-appropriate).

### Sanitization

`sanitize()` runs on **both** sides before a log is emitted/forwarded: keys matching `/secret|token|password|otp|authorization|cookie|apikey|privatekey|card|cvv|iban/i` → `[redacted]`, email-shaped values are masked, with depth + circular guards. Secrets never reach Workers Logs / Logpush. Devs must still avoid logging raw user-generated content.

## Wiring status

| Piece                                                                                                           | Status                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `libs/observability` (logger, metrics, ingest, reportError, context, sanitize)                                  | Complete in code and tests                                                                                                            |
| Workers Observability `console.*` capture                                                                       | Complete in source configuration (`observability: { enabled: true }`)                                                                 |
| AsyncLocalStorage request-context propagation                                                                   | Complete in tests under `nodejs_compat`                                                                                               |
| Client `/client-logs` ingestion endpoint + `configureClientLogger` + `reportError` → `onError`/error boundaries | Complete in `apps/ui`                                                                                                                 |
| `ANALYTICS` binding + first metric (`events_created`)                                                           | Binding is active and the metric is verified on the public Worker; community dashboards and alerts remain planned under P0-019/P1-019 |

The other app shells must wire the same ingestion and error-reporting path as they become functional.
The public Worker's Analytics Engine binding and `events_created` metric are verified; account-side
dashboard, alert and Logpush setup remains subject to dated provisioning verification rather than
being assumed from source declarations.

### Failure counters (CO-05)

Some failures are swallowed on purpose — a best-effort closeout intent must never be able to undo a
durable event, and an unreachable notification scheduler must never fail the RSVP behind it. A log
line is the wrong record for those, because nothing watches it. `libs/server-fns/src/alerts.ts`
therefore writes an Analytics Engine data point alongside the log:

| Counter                            | Index    | Raised when                                                                         |
| ---------------------------------- | -------- | ----------------------------------------------------------------------------------- |
| `closeout_intent_failed`           | market   | Scheduling an event's closeout prompt threw; the nightly backfill will re-derive it |
| `notification_schedule_arm_failed` | `global` | A Durable Object alarm could not be armed; the recovery sweep delivers late instead |

Both are counted per occurrence with `blob1` as the counter name, so a threshold is a
`WHERE blob1 = …` with a `GROUP BY index1`. Neither can throw: a failure to count is reported through
`reportError` and swallowed, because both call sites exist precisely because nothing there may throw.
A market whose counter climbs is running on its safety net, which is otherwise indistinguishable from
health — the sweep keeps delivering, fifteen minutes late.

## Logpush setup (P0-019)

To persist Workers Trace Events outside the default retention, create a **Logpush** job through the
dashboard/API for the account-scoped `workers_trace_events` dataset and send it to an approved
destination. This is required operational configuration, not a source-controlled capability, and is
currently unverified. See https://developers.cloudflare.com/logs.
