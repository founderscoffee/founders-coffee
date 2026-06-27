import { describe, expect, it } from 'vitest';

import { buildVectorizeFilter } from './filters.js';

describe('buildVectorizeFilter', () => {
  it('builds a $eq filter for marketCode', () => {
    expect(buildVectorizeFilter({ marketCode: 'DZ' })).toEqual({ marketCode: { $eq: 'DZ' } });
  });

  it('combines marketCode + type into one expression', () => {
    expect(buildVectorizeFilter({ marketCode: 'DZ', type: 'event' })).toEqual({
      marketCode: { $eq: 'DZ' },
      type: { $eq: 'event' },
    });
  });

  it('returns undefined when no filters apply', () => {
    expect(buildVectorizeFilter({})).toBeUndefined();
    expect(buildVectorizeFilter({ marketCode: undefined })).toBeUndefined();
  });
});
