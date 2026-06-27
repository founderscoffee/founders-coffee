import { AppError, err, ok, type Result } from '../result.js';

import { EMBEDDING_MODEL } from './models.js';
import type { AiRuntime } from './ports.js';

export interface EmbeddingSuccess {
  readonly vectors: number[][];
}

/** Parse the bge-m3 response `{ data: number[][] }` defensively; [] when absent/malformed. */
const parseVectors = (raw: unknown): number[][] => {
  if (raw !== null && typeof raw === 'object' && 'data' in raw) {
    const data = (raw as { data?: unknown }).data;
    if (
      Array.isArray(data) &&
      data.every((v) => Array.isArray(v) && v.every((n) => typeof n === 'number'))
    ) {
      return data as number[][];
    }
  }
  return [];
};

/**
 * Embed a batch of texts via Workers AI (bge-m3). Batched — never call one-text-at-a-time — so
 * reindex amortizes AI cost. Returns `Result`; failures (network/model/count mismatch) surface as
 * `ai_embed_failed` for the caller (worker-jobs) to retry via the queue DLQ.
 */
export const embed = async (
  ai: AiRuntime,
  texts: readonly string[],
): Promise<Result<EmbeddingSuccess>> => {
  if (texts.length === 0) return ok({ vectors: [] });
  try {
    const raw = await ai.run(EMBEDDING_MODEL, { text: [...texts] });
    const vectors = parseVectors(raw);
    if (vectors.length !== texts.length) {
      return err(
        new AppError('ai_embed_failed', `Expected ${texts.length} vectors, got ${vectors.length}`),
      );
    }
    return ok({ vectors });
  } catch (error) {
    return err(new AppError('ai_embed_failed', error instanceof Error ? error.message : 'embed failed'));
  }
};
