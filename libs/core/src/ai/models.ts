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

/** Instruct LLM for moderation + summarization (Workers AI text generation → { response }). Capable
 * and multilingual (ar/fr/en); swap to a smaller model (e.g. llama-3.2-3b) for cost tuning at P2-E. */
export const MODERATION_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/** Instruct LLM for summarization (P3 sponsorship-report narratives). */
export const SUMMARIZE_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
