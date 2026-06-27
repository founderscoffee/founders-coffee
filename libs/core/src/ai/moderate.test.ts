import { describe, expect, it } from 'vitest';

import type { AiRuntime } from './ports.js';
import { moderate } from './moderate.js';

const aiResponding = (response: string): AiRuntime => ({
  run: async () => ({ response }),
});

const throwingAi = (): AiRuntime => ({
  run: async () => {
    throw new Error('boom');
  },
});

describe('moderate', () => {
  it('flags + requires review for a flagged JSON decision', async () => {
    const result = await moderate(
      aiResponding('{"flagged": true, "categories": ["spam", "harassment"]}'),
      'bad text',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.flagged).toBe(true);
      expect(result.data.categories).toEqual(['spam', 'harassment']);
      expect(result.data.reviewRequired).toBe(true);
    }
  });

  it('returns clean (no review) for a clean decision', async () => {
    const result = await moderate(aiResponding('{"flagged": false, "categories": []}'), 'fine text');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.flagged).toBe(false);
      expect(result.data.reviewRequired).toBe(false);
    }
  });

  it('requires review when the model output is unparseable (fail-safe)', async () => {
    const result = await moderate(aiResponding('the model rambled with no JSON'), 'some text');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.flagged).toBe(false);
      expect(result.data.reviewRequired).toBe(true);
    }
  });

  it('tolerates JSON embedded in surrounding prose', async () => {
    const result = await moderate(aiResponding('Here: {"flagged": true, "categories": ["hate"]} done'), 'text');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.flagged).toBe(true);
  });

  it('short-circuits to clean for empty text', async () => {
    const result = await moderate(aiResponding('{"flagged": true}'), '   ');

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.reviewRequired).toBe(false);
  });

  it('errors when the runtime throws', async () => {
    const result = await moderate(throwingAi(), 'text');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('ai_moderation_failed');
  });
});
