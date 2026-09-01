# AI — Workers AI + Vectorize client (`core/ai`)

> **Release scope:** this is an existing technical foundation, not a current product commitment.
> Per the [community-first strategy](./release-strategy.md), AI work proceeds only when it directly
> removes a demonstrated blocker in the free local-event loop. Semantic search, challenge tooling,
> and sponsor reporting remain future work and must not delay the first release.

The AI/search client foundation for founders.coffee. Implements **P0-017** (SRS 8.1, D15): Workers AI (embeddings, moderation, summaries) + Vectorize (semantic search over events/challenges). Lives in **`core/src/ai/`**, exported via a server-only subpath **`@founders-coffee/core/ai`** (the main `@founders-coffee/core` barrel stays pure-primitive, so browser bundles never pull AI code). Per the "no new libs" directive, this is a module of `core`, not a separate library.

## Why ports-and-adapters (the Miniflare limitation)

The installed Miniflare runtime **does not locally emulate Workers AI or Vectorize**; those paths
require remote bindings or a real Cloudflare environment. Unit tests therefore exercise the pure
ports and orchestration, while real-binding integration belongs in staging.

`core/ai` therefore defines its own **ports** (`AiRuntime`, `VectorizeRuntime`) — the minimal surface it needs — and never imports a Cloudflare binding type. All logic is pure functions that take a port. Tests inject plain objects implementing the ports (AGENTS §11.5: mocking an external service _via its interface_ is allowed; this is **not** a §12 binding-mock, since `core/ai` touches no binding type). The real `env.AI` / `env.VECTOR` bind at the **app call-site**:

```ts
import { reindex, type AiRuntime, type VectorizeRuntime } from '@founders-coffee/core/ai';
await handleResult(reindex(env.AI as AiRuntime, env.VECTOR as VectorizeRuntime, docs));
```

`core` stays dep-free, node-env, no wrangler config, no `@cloudflare/workers-types` dependency. The one-line `as` asserts the real binding satisfies the port (true at runtime; if a future `Ai.run` overload rejects the port, add an `adaptAi(env.AI)` adapter in the app, not `core`).

## Models (locked)

| Capability        | Model                                      | Notes                                                                                                                                                                                                                                     |
| ----------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Embeddings**    | `@cf/baai/bge-m3`                          | Multilingual (100+ languages → ar/fr/en for Algeria-first). **1024 dims.** Drives the Vectorize index config (1024 dims, **cosine**) at P0-019. We embed ourselves (via the EMBEDDINGS queue), so Vectorize just stores 1024-dim vectors. |
| **Moderation**    | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Instruct LLM with a classification prompt → `{flagged, categories}`. Swappable to a smaller model for cost at P2-E.                                                                                                                       |
| **Summarization** | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | Instruct LLM, 1-2 sentence summary in the input's language. P3 sponsorship reports.                                                                                                                                                       |

There is no canonical "moderation"/"summarization" Workers AI model, so those prompt an instruct LLM.

## Surface

| export                                                                                               | role                                                                             |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `embed(ai, texts)`                                                                                   | Batch embed via bge-m3 → `Result<{vectors: number[][]}>`.                        |
| `moderate(ai, text)`                                                                                 | Classify → `Result<ModerationResult>` (`{flagged, categories, reviewRequired}`). |
| `summarize(ai, text)`                                                                                | 1-2 sentence summary → `Result<string>`.                                         |
| `upsertDocuments(index, docs)`                                                                       | Idempotent upsert (by id) into Vectorize.                                        |
| `search(index, vector, {topK, filter})`                                                              | Ranked similarity search (filter scopes by market/type).                         |
| `reindex(ai, index, docs)`                                                                           | chunk → embed → upsert. Idempotent; long docs → sub-vectors `id#chunk`.          |
| `chunkText`, `buildVectorizeFilter`                                                                  | Pure helpers.                                                                    |
| `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, `VECTORIZE_METRIC`, `MODERATION_MODEL`, `SUMMARIZE_MODEL` | Constants (P0-019 reads dims + metric).                                          |

All return `Result` (the P0-012 hybrid model — callers unwrap via `handleResult`).

## Reindex flow (the async embedding path)

`reindex` is the orchestration worker-jobs calls from its EMBEDDINGS consumer (P0-018): a doc is chunked → each chunk embedded (batched) → upserted into Vectorize keyed `id` (or `id#chunkIndex` for multi-chunk docs). Upsert-by-id makes it **idempotent** — a retried queue message or a concurrent update ends with the last writer winning; no locking. Embeddings are generated **async via the queue, never inline in a request**, so event create/update flows stay resilient to AI latency.

## Moderation policy

Conservative + fail-safe. `reviewRequired` is `true` whenever the text is flagged **or** the model output can't be parsed (a human looks). The caller (P2-E hackathon) escalates flagged content to human review and **never auto-blocks** — a deliberate hedge against the higher false-positive rate moderation models show on Arabic text.

## Testing

`core/ai` tests run in the **node environment** (no Miniflare pool needed) with plain port fakes:
embed count/parse/throw, Vectorize upsert/search/filter passthrough, reindex chunking and idempotency,
filters, moderation parsing, and summarization behavior.

## Consumers + deferrals

- **P0-018** `apps/worker-jobs` contains the EMBEDDINGS consumer path, but production queue binding and delivery remain unverified.
- **P1-015 (future)** UI semantic search → `embed` (query) + `search`; reconsider only when event density makes it useful.
- **P2-E (future)** hackathon moderation/plagiarism → `moderate` + similarity heuristics.
- **P3 (future)** sponsorship reports → `summarize`.
- **Provisioning (P0-019):** staging and production Vectorize indexes use environment-specific names with **1024 dims + cosine metric** (must match bge-m3); each consumer declares `AI` + `VECTOR` bindings. Account-side existence and real calls must be verified. Mismatched dimensions produce invalid recall.
