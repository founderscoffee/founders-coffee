# worker-jobs — Queue + Cron consumer (`apps/worker-jobs`)

The system worker for founders.coffee — the 4th app (SRS D12, 8.2). No UI. It's the async backbone: it consumes Queues + a Cron trigger so request paths stay fast + resilient. Implements **P0-018** (§4).

## What it consumes

| Queue / trigger | Consumer does | Uses |
|---|---|---|
| `NOTIFICATIONS` | dispatch a pre-rendered email | `libs/email` (`CloudflareEmailProvider`) |
| `EMBEDDINGS` | re-embed + upsert docs into Vectorize | `core/ai` (`reindex`) |
| `RECONCILE` (cron + queue) | count pending orders → backlog metric (NFR-7) | `libs/db` (`countOrdersByStatus`) + `libs/observability` |
| cron (`0 3 * * *`, daily) | drives `RECONCILE` as a backstop | — |

Queue names are canonical in `RESOURCES.queues` ([libs/infra/src/resources.ts](libs/infra/src/resources.ts)). **Producers are the other apps** (UI/dashboard/admin server-fns) — they enqueue via producer bindings (wired at P1-009/P1-005). worker-jobs **only consumes**.

## Per-message ack/retry + DLQ

The `queue` handler processes each message individually: on `ok` → `message.ack()`; on `err` → `message.retry()`. A failing message is retried **on its own** (no re-sending siblings — avoids double-email). After `max_retries: 3`, Cloudflare routes it to the per-queue dead-letter queue (declared in `wrangler.jsonc`). A DLQ *consumer* (alert/replay) is P1; for now DLQ messages persist + surface via observability.

## Processor pattern (testable)

Each consumer's logic is a processor function with **injected dependencies** ([src/jobs/](apps/worker-jobs/src/jobs/)):

```ts
processNotification(email: EmailProvider, msg)         // fake provider in tests
processEmbeddings(ai: AiRuntime, vectorize, msg)        // fake ports in tests
runReconcile(db: Db)                                    // real D1 in tests
```

The thin `ExportedHandler` ([src/index.ts](apps/worker-jobs/src/index.ts)) wires real `env.*` to the processors (`createCloudflareEmailProvider(env.EMAIL, …)`, `env.AI as AiRuntime`, `createDb(env.DB)`). This separation is what makes the consumers unit-testable.

## Testing (AGENTS §12 — no binding mocks)

- **NOTIFICATIONS** — `processNotification` with a fake `EmailProvider`; the handler end-to-end via `createMessageBatch` + `worker.queue(batch, env, ctx)` + `getQueueResult` against the **real Miniflare `EMAIL`** binding (acks an allowed recipient, retries a disallowed one).
- **EMBEDDINGS** — `processEmbeddings` with fake `AiRuntime`/`VectorizeRuntime` ports. Miniflare does **not** emulate Workers AI / Vectorize (remote-proxy only — see `docs/ai.md`), so the handler's AI/Vectorize path isn't exercised in Miniflare; the processor's port-fake test covers the logic, and real-binding integration is a staging concern.
- **RECONCILE** — `runReconcile` against **real D1** (Miniflare, with `libs/db` migrations applied in `setup.ts`).

## Scheduling philosophy

DO Alarms (P1-010) own **per-entity** timing (event reminders, challenge phase transitions) — this worker's cron is a **backstop only** (the daily reconcile sweep), never a D1-polling reminder loop.

## Bindings + deferrals

- **Bindings** (`wrangler.jsonc`): `DB`, `EMAIL`, `AI`, `VECTOR`, + the 3 queue consumers (each `max_retries: 3` + a DLQ). Provisioning (real `database_id`, sender-domain verification, DLQ queues created) is **P0-019**; the `database_id` is a placeholder until then.
- **Producer bindings cross-app** — UI/dashboard/admin each need producer bindings to enqueue NOTIFICATIONS/EMBEDDINGS (P1-009/P1-005, provisioned P0-019).
- **`Env`** is defined manually ([src/env.ts](apps/worker-jobs/src/env.ts)) like `apps/admin`'s `AdminEnv` — typecheck needs no `wrangler types` step.
- **P1-009** notifications producer (RSVP/reminder triggers → enqueue). **P1-014** reconcile admin nudges for stale payments. **P2-E** moderation (separate consumer/queue).
