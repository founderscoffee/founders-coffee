import { describe, expect, it } from 'vitest';
import type { AiRuntime, VectorizeRuntime } from '@founders-coffee/core/ai';

import { processEmbeddings } from './embeddings.js';

/** Fake AI — returns one copy of `vector` per input text (so embed's count check passes). */
const fakeAi = (vector: number[]): AiRuntime => ({
  run: async (_model, options) => {
    const text = (options as { text?: unknown }).text;
    const n = Array.isArray(text) ? text.length : 1;
    return { data: Array.from({ length: n }, () => vector) };
  },
});

const fakeVectorize = (): VectorizeRuntime => ({
  upsert: async (docs) => ({ ids: docs.map((d) => d.id) }),
  query: async () => ({ matches: [] }),
});

describe('processEmbeddings', () => {
  it('reindexes documents and returns the upserted ids', async () => {
    const result = await processEmbeddings(fakeAi([0.1]), fakeVectorize(), {
      docs: [
        { id: 'evt_1', text: 'hello' },
        { id: 'evt_2', text: 'world' },
      ],
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.upserted).toEqual(['evt_1', 'evt_2']);
  });

  it('returns ok with empty upserted for no docs', async () => {
    const result = await processEmbeddings(fakeAi([0.1]), fakeVectorize(), {
      docs: [],
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.upserted).toEqual([]);
  });
});
