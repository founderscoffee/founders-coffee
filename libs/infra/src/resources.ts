/**
 * Canonical Cloudflare resource names — the single source of truth consumed by
 * provisioning (P0-019) and wrangler configs. Names are stable across environments;
 * provisioning suffixes per-env (e.g. `-staging`) where needed.
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
