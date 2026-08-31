/**
 * Ports over the Workers AI + Vectorize bindings — the minimal surface `core/ai` needs.
 * Deliberately decoupled from `@cloudflare/workers-types`: Miniflare does NOT emulate the AI or
 * Vectorize bindings (remote-proxy only), so defining our own ports lets us test with plain fakes
 * in the node environment (AGENTS §11.5 — mocking an external service *via its interface*). The
 * real `env.AI` / `env.VECTOR` satisfy these structurally and are bound at the app call-site
 * (P0-018 worker-jobs, P1-015 UI search) — see `docs/ai.md`.
 */

/** The subset of the Workers AI `Ai` binding we call. */
export interface AiRuntime {
  run(model: string, options: Record<string, unknown>): Promise<unknown>;
}

/** A document to upsert into a Vectorize index. */
export interface VectorizeUpsertDoc {
  readonly id: string;
  readonly values: readonly number[];
  readonly metadata?: Record<string, unknown>;
}

/** A scored search match returned by Vectorize. */
export interface VectorizeMatch {
  readonly id: string;
  readonly score: number;
  readonly metadata?: Record<string, unknown>;
}

/** Query options understood by both the port and the real Vectorize binding. */
export interface VectorizeQueryOptions {
  readonly topK?: number;
  readonly filter?: Record<string, unknown>;
  readonly returnMetadata?: boolean;
}

/** The subset of the Vectorize `VectorizeIndex` binding we call. */
export interface VectorizeRuntime {
  upsert(
    docs: readonly VectorizeUpsertDoc[],
  ): Promise<{ readonly ids: readonly string[] }>;
  query(
    vector: readonly number[],
    options: VectorizeQueryOptions,
  ): Promise<{ readonly matches: readonly VectorizeMatch[] }>;
}
