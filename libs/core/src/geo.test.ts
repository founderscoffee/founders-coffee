import { describe, expect, it } from 'vitest';

import { hasVenueMoved, metresBetween, VENUE_MOVE_MIN_METRES } from './geo.js';

const ALGIERS = { latitude: 36.7538, longitude: 3.0588 };

describe('metresBetween', () => {
  it('reads a thousandth of a degree of latitude as about 111 metres', () => {
    const north = { ...ALGIERS, latitude: ALGIERS.latitude + 0.001 };

    expect(metresBetween(ALGIERS, north)).toBeCloseTo(111.19, 1);
  });

  it('is zero for a point against itself', () => {
    expect(metresBetween(ALGIERS, ALGIERS)).toBe(0);
  });

  it('does not care which way round the two points are given', () => {
    const other = { latitude: 36.8008, longitude: 3.1008 };

    expect(metresBetween(ALGIERS, other)).toBeCloseTo(
      metresBetween(other, ALGIERS),
      6,
    );
  });
});

describe('hasVenueMoved', () => {
  it('says no when there was never a point to move from', () => {
    expect(
      hasVenueMoved({ latitude: null, longitude: null }, ALGIERS),
      'most published meetups carry no coordinates, so a host dropping the first pin on the cafe named in the title is describing where it always was',
    ).toBe(false);
  });

  it('says no when only one half of the old point was stored', () => {
    expect(hasVenueMoved({ latitude: 36.7538, longitude: null }, ALGIERS)).toBe(
      false,
    );
  });

  it('ignores a nudge inside the block', () => {
    const nudged = { ...ALGIERS, latitude: ALGIERS.latitude + 0.0005 };

    expect(
      metresBetween(ALGIERS, nudged),
      'the fixture has to sit under the threshold for this test to mean anything',
    ).toBeLessThan(VENUE_MOVE_MIN_METRES);
    expect(
      hasVenueMoved(ALGIERS, nudged),
      'dragging the pin from the middle of the building to its door leads to the same doorway',
    ).toBe(false);
  });

  it('reports a move across the city', () => {
    expect(
      hasVenueMoved(ALGIERS, { latitude: 36.8008, longitude: 3.1008 }),
    ).toBe(true);
  });

  it('counts the threshold itself as a move', () => {
    const exact = { ...ALGIERS, latitude: ALGIERS.latitude + 0.0009 };

    expect(
      metresBetween(ALGIERS, exact),
      'a hundred metres is the smallest distance this product is willing to call somewhere else',
    ).toBeGreaterThanOrEqual(VENUE_MOVE_MIN_METRES);
    expect(hasVenueMoved(ALGIERS, exact)).toBe(true);
  });
});
