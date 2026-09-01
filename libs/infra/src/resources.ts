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
