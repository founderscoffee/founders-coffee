import type { Result } from '@founders-coffee/core';
import { reindex, type AiRuntime, type ReindexResult, type VectorizeRuntime } from '@founders-coffee/core/ai';

import type { EmbeddingsMessage } from './messages.js';

/**
 * Re-embed + upsert the message's documents into Vectorize (idempotent by id). `ai` + `vectorize`
 * are the core/ai ports — injected so this is unit-testable with fakes (Miniflare does not emulate
 * Workers AI / Vectorize). The handler binds them from `env.AI` / `env.VECTOR`.
 */
export const processEmbeddings = (
  ai: AiRuntime,
  vectorize: VectorizeRuntime,
  message: EmbeddingsMessage,
): Promise<Result<ReindexResult>> => reindex(ai, vectorize, message.docs);
