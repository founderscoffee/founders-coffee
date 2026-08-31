import { describe, expect, it } from 'vitest';

import type {
  VectorizeMatch,
  VectorizeQueryOptions,
  VectorizeRuntime,
} from './ports.js';
import { search, upsertDocuments } from './vectorize.js';

const captureIndex = (matches: readonly VectorizeMatch[] = []) => {
  const captured: { options?: VectorizeQueryOptions } = {};
  const runtime: VectorizeRuntime = {
    upsert: async (docs) => ({ ids: docs.map((d) => d.id) }),
    query: async (_vector, options) => {
      captured.options = options;
      return { matches };
    },
  };
  return { runtime, captured };
};

const throwingQueryIndex = (): VectorizeRuntime => ({
  upsert: async () => ({ ids: [] }),
  query: async () => {
    throw new Error('boom');
  },
});

describe('search', () => {
  it('returns matches sorted by score descending', async () => {
    const { runtime } = captureIndex([
      { id: 'low', score: 0.1 },
      { id: 'high', score: 0.9 },
    ]);

    const result = await search(runtime, [0.5], { topK: 5 });

    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.data.map((m) => m.id)).toEqual(['high', 'low']);
  });

  it('passes the filter + default topK through to the index', async () => {
    const { runtime, captured } = captureIndex([]);

    await search(runtime, [0.5], { filter: { marketCode: { $eq: 'DZ' } } });

    expect(captured.options?.topK).toBe(10);
    expect(captured.options?.filter).toEqual({ marketCode: { $eq: 'DZ' } });
    expect(captured.options?.returnMetadata).toBe(true);
  });

  it('errors when the query throws', async () => {
    const result = await search(throwingQueryIndex(), [0.5]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('vectorize_query_failed');
  });
});

describe('upsertDocuments', () => {
  it('returns the upserted ids', async () => {
    const { runtime } = captureIndex();

    const result = await upsertDocuments(runtime, [
      { id: 'a', values: [0.1] },
      { id: 'b', values: [0.2] },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.upserted).toEqual(['a', 'b']);
  });

  it('returns ok with empty upserted for no docs', async () => {
    const { runtime } = captureIndex();

    const result = await upsertDocuments(runtime, []);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.upserted).toEqual([]);
  });

  it('errors when upsert throws', async () => {
    const runtime: VectorizeRuntime = {
      upsert: async () => {
        throw new Error('boom');
      },
      query: async () => ({ matches: [] }),
    };

    const result = await upsertDocuments(runtime, [{ id: 'a', values: [0.1] }]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('vectorize_upsert_failed');
  });
});
