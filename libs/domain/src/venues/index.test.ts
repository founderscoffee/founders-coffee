import { describe, expect, it } from 'vitest';

import { DZ_CITY_VENUES } from './data/dz.js';
import { EG_CITY_VENUES } from './data/eg.js';
import { SA_CITY_VENUES } from './data/sa.js';
import {
  findSnapshotVenue,
  getCityVenues,
  getCityViewportSnapshot,
  isSnapshotProviderId,
  matchSnapshotVenue,
} from './index.js';
import type { SnapshotVenue } from './types.js';

const cafe: SnapshotVenue = {
  providerId: 'osm:node/1',
  kind: 'poi',
  name: 'Founders Café',
  nameLatin: 'Founders Café',
  address: '12 Startup Street',
  latitude: 36.7538,
  longitude: 3.0588,
  category: 'cafe',
  eligible: true,
};

const restaurant: SnapshotVenue = {
  ...cafe,
  providerId: 'osm:node/2',
  name: 'Tantonville Rooftop',
  category: 'restaurant',
  eligible: false,
};

const at = (latitude: number, longitude: number) => ({ latitude, longitude });

const SNAPSHOT_CITY_CODES: Record<string, Record<string, unknown>> = {
  DZ: DZ_CITY_VENUES,
  EG: EG_CITY_VENUES,
  SA: SA_CITY_VENUES,
};

describe('venue snapshot matching', () => {
  it('recognises only its own provider ids', () => {
    expect(isSnapshotProviderId('osm:node/1')).toBe(true);
    expect(isSnapshotProviderId('dXJuOm1ieHBvaTo')).toBe(false);
  });

  it('matches a stored venue at its stored point', () => {
    expect(
      matchSnapshotVenue(
        [cafe],
        cafe.providerId,
        at(cafe.latitude, cafe.longitude),
      ),
    ).toEqual(cafe);
  });

  it('tolerates a small drift but not a different place', () => {
    expect(
      matchSnapshotVenue([cafe], cafe.providerId, at(36.75405, 3.0588)),
    ).toEqual(cafe);
    expect(
      matchSnapshotVenue([cafe], cafe.providerId, at(36.7628, 3.0588)),
    ).toBeNull();
  });

  it('refuses a provider id the map provider issued', () => {
    expect(
      matchSnapshotVenue(
        [{ ...cafe, providerId: 'mapbox-poi-1' }],
        'mapbox-poi-1',
        at(cafe.latitude, cafe.longitude),
      ),
    ).toBeNull();
  });

  it('refuses an id that is not in the city snapshot', () => {
    expect(
      matchSnapshotVenue(
        [cafe],
        'osm:node/999',
        at(cafe.latitude, cafe.longitude),
      ),
    ).toBeNull();
  });

  it('never resolves an ineligible venue', () => {
    expect(
      matchSnapshotVenue(
        [restaurant],
        restaurant.providerId,
        at(restaurant.latitude, restaurant.longitude),
      ),
    ).toBeNull();
  });

  it('returns an empty list for a city that was never snapshotted', () => {
    expect(getCityVenues('DZ', 'not-a-city')).toEqual([]);
    expect(getCityVenues('XX', '556')).toEqual([]);
    expect(findSnapshotVenue('XX', '556', 'osm:node/1', at(0, 0))).toBeNull();
  });
});

describe('city viewport snapshot', () => {
  it('returns nothing for a city that was never snapshotted', () => {
    expect(getCityViewportSnapshot('XX', '556')).toBeNull();
    expect(getCityViewportSnapshot('DZ', 'not-a-city')).toBeNull();
  });

  it('returns a centre inside its own bounds for every snapshotted city', () => {
    let checked = 0;
    for (const marketCode of ['DZ', 'EG', 'SA']) {
      for (const cityCode of Object.keys(SNAPSHOT_CITY_CODES[marketCode])) {
        const stored = getCityViewportSnapshot(marketCode, cityCode);
        expect(stored).not.toBeNull();
        if (!stored) continue;
        const [west, south, east, north] = stored.bounds;
        expect(stored.center.longitude).toBeGreaterThanOrEqual(west);
        expect(stored.center.longitude).toBeLessThanOrEqual(east);
        expect(stored.center.latitude).toBeGreaterThanOrEqual(south);
        expect(stored.center.latitude).toBeLessThanOrEqual(north);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
