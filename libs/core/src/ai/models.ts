/**
 * Workers AI model + Vectorize index constants. The embedding model + its dimensionality are
 * locked together: bge-m3 is multilingual (100+ languages → ar/fr/en for Algeria-first) and emits
 * 1024-dim vectors. The Vectorize index (P0-019 provisioning) MUST be created with these same
 * dimensions + the cosine metric, or every query returns noise.
 */
export const EMBEDDING_MODEL = '@cf/baai/bge-m3';

/** bge-m3 dense-vector dimensionality. Must match the Vectorize index `dimensions`. */
export const EMBEDDING_DIMENSIONS = 1024;

/** Vectorize distance metric paired with bge-m3 (normalized cosine similarity). */
export const VECTORIZE_METRIC = 'cosine';
