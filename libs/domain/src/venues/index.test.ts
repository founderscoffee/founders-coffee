import { describe, expect, it } from 'vitest';

import { DZ_CITY_VENUES } from './data/dz.js';
import { EG_CITY_VENUES } from './data/eg.js';
import { SA_CITY_VENUES } from './data/sa.js';
import {
  containsPoint,
  findCityByPoint,
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

describe('locating a host outside their selected city', () => {
  const algiers = { latitude: 36.7538, longitude: 3.0588 };
  const oran = { latitude: 35.6971, longitude: -0.6349 };
  const paris = { latitude: 48.8566, longitude: 2.3522 };

  it('says which snapshotted city a point falls in', () => {
    const found = findCityByPoint('DZ', algiers);
    expect(found).not.toBeNull();
    const stored = found && getCityViewportSnapshot('DZ', found.cityCode);
    expect(stored).not.toBeNull();
    if (stored) expect(containsPoint(stored.bounds, algiers)).toBe(true);
  });

  it('resolves a different city for a point in a different city', () => {
    const here = findCityByPoint('DZ', algiers);
    const there = findCityByPoint('DZ', oran);
    expect(here).not.toBeNull();
    expect(there).not.toBeNull();
    expect(there?.cityCode).not.toBe(here?.cityCode);
  });

  it('refuses to guess a city for a point far outside the market', () => {
    expect(findCityByPoint('DZ', paris)).toBeNull();
  });

  it('still resolves a point just outside a city but close to its centre', () => {
    const inCity = findCityByPoint('DZ', algiers);
    expect(inCity).not.toBeNull();
    if (!inCity) return;
    const stored = getCityViewportSnapshot('DZ', inCity.cityCode);
    expect(stored).not.toBeNull();
    if (!stored) return;
    const justOutside = {
      latitude: stored.bounds[3] + 0.02,
      longitude: stored.center.longitude,
    };
    expect(containsPoint(stored.bounds, justOutside)).toBe(false);
    expect(findCityByPoint('DZ', justOutside)).not.toBeNull();
  });

  it('returns nothing for a market with no snapshot', () => {
    expect(findCityByPoint('XX', algiers)).toBeNull();
  });

  it('reads bounds as west, south, east, north', () => {
    const bounds = [2.9, 36.6, 3.3, 36.9] as const;
    expect(containsPoint(bounds, { latitude: 36.75, longitude: 3.05 })).toBe(
      true,
    );
    expect(containsPoint(bounds, { latitude: 3.05, longitude: 36.75 })).toBe(
      false,
    );
  });
});
