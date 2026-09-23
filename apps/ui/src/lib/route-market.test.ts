import { describe, expect, it } from 'vitest';

import { isMarketLeaf } from './route-market';

describe('isMarketLeaf', () => {
  it('says a market path is the page being asked for', () => {
    expect(isMarketLeaf('/en/algeria')).toBe(true);
    expect(isMarketLeaf('/en/algeria/')).toBe(true);
  });

  it('says a market path under a city is not', () => {
    expect(
      isMarketLeaf('/en/algeria/algiers'),
      'this loader runs for the city route too, and would answer it with the market page',
    ).toBe(false);
  });

  it('counts from a path that carries its language, because every path here does', () => {
    expect(
      isMarketLeaf('/ar/saudi-arabia'),
      'the layout answers an unprefixed address with the prefixed one before any loader runs, so counting to a fixed depth is safe in a way it was not while the prefix was optional',
    ).toBe(true);
  });
});
