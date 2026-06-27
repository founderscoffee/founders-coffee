import { describe, expect, it } from 'vitest';

import { chunkText } from './chunk.js';

describe('chunkText', () => {
  it('returns [] for blank text', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   ')).toEqual([]);
  });

  it('returns the whole text as one chunk when under the limit', () => {
    expect(chunkText('hello')).toEqual(['hello']);
  });

  it('trims surrounding whitespace before chunking', () => {
    expect(chunkText('  hi  ')).toEqual(['hi']);
  });

  it('splits long text on the maxChars boundary and round-trips', () => {
    const full = 'x'.repeat(10_000);
    const chunks = chunkText(full, 4000);

    expect(chunks).toHaveLength(3);
    expect(chunks.join('')).toBe(full);
  });
});
