import { describe, expect, it } from 'vitest';

import type { AiRuntime, VectorizeMatch, VectorizeRuntime } from './ports.js';
import { reindex } from './reindex.js';

/** Fake AI that returns one copy of `vector` per input text (so embed's count check passes). */
const fakeAi = (vector: number[]): AiRuntime => ({
  run: async (_model, options) => {
    const text = (options as { text?: unknown }).text;
    const count = Array.isArray(text) ? text.length : 1;
    return { data: Array.from({ length: count }, () => vector) };
  },
});

const captureIndex = () => {
  const upserted: { id: string; values: number[] }[] = [];
  const runtime: VectorizeRuntime = {
    upsert: async (docs) => {
      for (const d of docs) upserted.push({ id: d.id, values: [...d.values] });
      return { ids: docs.map((d) => d.id) };
    },
    query: async () => ({ matches: [] as VectorizeMatch[] }),
  };
  return { runtime, upserted };
};

describe('reindex', () => {
  it('embeds + upserts a short document under its id', async () => {
    const { runtime, upserted } = captureIndex();

    const result = await reindex(fakeAi([0.1, 0.2]), runtime, [
      { id: 'evt_1', text: 'hello' },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.upserted).toEqual(['evt_1']);
      expect(upserted).toEqual([{ id: 'evt_1', values: [0.1, 0.2] }]);
    }
  });

  it('chunks a long document into sub-vectors keyed id#index', async () => {
    const { runtime, upserted } = captureIndex();

    await reindex(fakeAi([0.5]), runtime, [
      { id: 'evt_1', text: 'x'.repeat(10_000) },
    ]);

    expect(upserted).toHaveLength(3);
    expect(upserted.map((u) => u.id)).toEqual([
      'evt_1#0',
      'evt_1#1',
      'evt_1#2',
    ]);
  });

  it('returns ok with empty upserted for blank text', async () => {
    const { runtime } = captureIndex();

    const result = await reindex(fakeAi([0.5]), runtime, [
      { id: 'evt_1', text: '   ' },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.upserted).toEqual([]);
  });

  it('propagates an embed failure', async () => {
    const ai: AiRuntime = {
      run: async () => {
        throw new Error('boom');
      },
    };
    const { runtime } = captureIndex();

    const result = await reindex(ai, runtime, [{ id: 'evt_1', text: 'hello' }]);

    expect(result.ok).toBe(false);
  });
});
