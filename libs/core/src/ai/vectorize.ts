import { AppError, err, ok, type Result } from '../result.js';

import type {
  VectorizeMatch,
  VectorizeQueryOptions,
  VectorizeRuntime,
  VectorizeUpsertDoc,
} from './ports.js';

export type RankedMatch = VectorizeMatch;

export interface UpsertResult {
  readonly upserted: readonly string[];
}

/** Upsert pre-computed vectors into the index. Idempotent by doc id (last writer wins). */
export const upsertDocuments = async (
  index: VectorizeRuntime,
  docs: readonly VectorizeUpsertDoc[],
): Promise<Result<UpsertResult>> => {
  if (docs.length === 0) return ok({ upserted: [] });
  try {
    const result = await index.upsert([...docs]);
    return ok({ upserted: result.ids });
  } catch (error) {
    return err(
      new AppError('vectorize_upsert_failed', error instanceof Error ? error.message : 'upsert failed'),
    );
  }
};

/**
 * Semantic search: query the index with a vector, return matches ranked by score (desc). Vectorize
 * already returns matches ranked, but we sort defensively. `filter` scopes by metadata (market/type).
 */
export const search = async (
  index: VectorizeRuntime,
  vector: readonly number[],
  options: VectorizeQueryOptions = {},
): Promise<Result<RankedMatch[]>> => {
  try {
    const result = await index.query(vector, {
      topK: options.topK ?? 10,
      filter: options.filter,
      returnMetadata: options.returnMetadata ?? true,
    });
    return ok([...result.matches].sort((a, b) => b.score - a.score));
  } catch (error) {
    return err(
      new AppError('vectorize_query_failed', error instanceof Error ? error.message : 'query failed'),
    );
  }
};
