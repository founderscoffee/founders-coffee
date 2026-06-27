/** Worker bindings for apps/worker-jobs. Mirrors wrangler.jsonc (P0-019 provisions the real
 * database_id + sender domain + DLQ queues). Defined manually (like apps/admin's AdminEnv) so
 * typecheck needs no `wrangler types` generation step. */
export interface Env {
  readonly DB: D1Database;
  readonly EMAIL: SendEmail;
  readonly AI: Ai;
  readonly VECTOR: VectorizeIndex;
}
