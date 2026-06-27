import { err, ok, type Result } from '../result.js';

import { chunkText } from './chunk.js';
import { embed } from './embed.js';
import type { AiRuntime, VectorizeRuntime, VectorizeUpsertDoc } from './ports.js';
import { upsertDocuments } from './vectorize.js';

export interface ReindexDocument {
  readonly id: string;
  readonly text: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ReindexResult {
  readonly upserted: readonly string[];
}

/**
 * Re-embed + upsert documents into Vectorize. Called by worker-jobs' EMBEDDINGS consumer
 * (P0-018) — never inline in a request. Long docs are chunked; each chunk becomes a sub-vector keyed
 * `<id>#<index>` so partial re-indexing stays consistent. Upsert-by-id makes this idempotent: a
 * retried job (or a concurrent update) ends with the last writer winning — no locking needed.
 */
export const reindex = async (
  ai: AiRuntime,
  index: VectorizeRuntime,
  docs: readonly ReindexDocument[],
): Promise<Result<ReindexResult>> => {
  const toEmbed: string[] = [];
  const keys: string[] = [];
  const metas: (Record<string, unknown> | undefined)[] = [];

  for (const doc of docs) {
    const chunks = chunkText(doc.text);
    chunks.forEach((chunk, chunkIndex) => {
      toEmbed.push(chunk);
      keys.push(chunks.length > 1 ? `${doc.id}#${chunkIndex}` : doc.id);
      metas.push(doc.metadata);
    });
  }

  if (toEmbed.length === 0) return ok({ upserted: [] });

  const embedded = await embed(ai, toEmbed);
  if (!embedded.ok) return err(embedded.error);

  const upsertDocs: VectorizeUpsertDoc[] = keys.map((id, i) => ({
    id,
    values: embedded.data.vectors[i],
    metadata: metas[i],
  }));

  const upserted = await upsertDocuments(index, upsertDocs);
  if (!upserted.ok) return err(upserted.error);
  return ok({ upserted: upserted.data.upserted });
};
