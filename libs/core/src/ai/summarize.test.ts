import { describe, expect, it } from 'vitest';

import type { AiRuntime } from './ports.js';
import { summarize } from './summarize.js';

const aiResponding = (response: string): AiRuntime => ({
  run: async () => ({ response }),
});

const throwingAi = (): AiRuntime => ({
  run: async () => {
    throw new Error('boom');
  },
});

describe('summarize', () => {
  it('returns the trimmed summary string', async () => {
    const result = await summarize(aiResponding('  A concise summary.  '), 'long text');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe('A concise summary.');
  });

  it('short-circuits to empty for empty input', async () => {
    const result = await summarize(aiResponding('whatever'), '   ');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe('');
  });

  it('errors on a missing/blank response', async () => {
    const result = await summarize(aiResponding('   '), 'long text');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('ai_summarize_failed');
  });

  it('errors when the runtime throws', async () => {
    const result = await summarize(throwingAi(), 'long text');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('ai_summarize_failed');
  });
});
