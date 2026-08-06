/**
 * Canonical Cloudflare resource **base** names — the single source of truth for provisioning
 * (P0-019) and the wrangler configs.
 *
 * Account-scoped resources are provisioned once per deploy environment and carry the environment
 * as a suffix: `founders-coffee-db` becomes `founders-coffee-db-staging` and
 * `founders-coffee-db-production`. The wrangler configs are static JSON and cannot import this
 * module, so the suffixed names are written out literally in each `env.<name>` block — keep them in
 * step with the bases here. See [`docs/provisioning.md`](../../../docs/provisioning.md).
 *
 * Queue names are the exception: they are matched against `batch.queue` at runtime in
 * `apps/worker-jobs`, so they are consumed from this object directly.
 *
 * Only `d1` and `vectorize` are provisioned today. `r2`, `kv` and `analytics` are registered here
 * but not yet bound by any app; they are provisioned in the change that first binds them.
 */
export const RESOURCES = {
  d1: {
    database: 'founders-coffee-db',
  },
  r2: {
    images: 'founders-coffee-images',
  },
  kv: {
    featureFlags: 'founders-coffee-flags',
  },
  vectorize: {
    embeddings: 'founders-coffee-embeddings',
  },
  analytics: {
    dataset: 'founders-coffee-metrics',
  },
  queues: {
    notifications: 'founders-coffee-notifications',
    embeddings: 'founders-coffee-embeddings-jobs',
    reconcile: 'founders-coffee-reconcile',
  },
} as const;
