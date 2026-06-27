import { describe, expect, it } from 'vitest';

import { embed } from './embed.js';
import type { AiRuntime } from './ports.js';

const aiReturning = (data: unknown): AiRuntime => ({
  run: async () => data,
});

const throwingAi = (message: string): AiRuntime => ({
  run: async () => {
    throw new Error(message);
  },
});

describe('embed', () => {
  it('parses a bge-m3 response into vectors preserving order', async () => {
    const result = await embed(aiReturning({ data: [[0.1, 0.2], [0.3, 0.4]] }), ['one', 'two']);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.vectors).toEqual([[0.1, 0.2], [0.3, 0.4]]);
  });

  it('returns ok with empty vectors for no input', async () => {
    const result = await embed(aiReturning({ data: [] }), []);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.vectors).toEqual([]);
  });

  it('errors when the vector count mismatches the input', async () => {
    const result = await embed(aiReturning({ data: [[0.1]] }), ['a', 'b']);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('ai_embed_failed');
  });

  it('errors on a malformed response (no data field)', async () => {
    const result = await embed(aiReturning({}), ['a']);

    expect(result.ok).toBe(false);
  });

  it('errors when the runtime throws', async () => {
    const result = await embed(throwingAi('boom'), ['a']);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('ai_embed_failed');
  });
});
