import { describe, expect, it } from 'vitest';

import {
  findCity,
  findCityBySlug,
  findState,
  getCities,
  getFeaturedCities,
  getStates,
  searchLocations,
} from './index.js';

const ALGIERS = { code: '556', slug: 'algiers', stateCode: '16' };

describe('geo lookups', () => {
  it('exposes the states of every supported market', () => {
    for (const country of ['DZ', 'EG', 'SA']) {
      expect(getStates(country).length, country).toBeGreaterThan(0);
    }
  });

  it('answers an unsupported country with empty results rather than throwing', () => {
    expect(getStates('ZZ')).toEqual([]);
    expect(getCities('ZZ', '16')).toEqual([]);
    expect(getFeaturedCities('ZZ')).toEqual([]);
    expect(findCity('ZZ', '556')).toBeUndefined();
    expect(findState('ZZ', '16')).toBeUndefined();
    expect(findCityBySlug('ZZ', 'algiers')).toBeUndefined();
    expect(searchLocations('ZZ', 'alg')).toEqual([]);
  });

  it('scopes cities to their own state', () => {
    const cities = getCities('DZ', ALGIERS.stateCode);
    expect(cities.length).toBeGreaterThan(0);
    expect(cities.every((city) => city.stateCode === ALGIERS.stateCode)).toBe(
      true,
    );
  });

  it('returns only featured cities as featured', () => {
    const featured = getFeaturedCities('DZ');
    expect(featured.length).toBeGreaterThan(0);
    expect(featured.every((city) => city.featured)).toBe(true);
  });

  it('finds a city by code and its state by code', () => {
    const city = findCity('DZ', ALGIERS.code);
    expect(city?.slug).toBe(ALGIERS.slug);
    expect(city).toBeDefined();
    if (!city) return;
    expect(findState('DZ', city.stateCode)?.name).toBe('Alger');
  });

  it('resolves a legacy city slug through its alias', () => {
    expect(findCityBySlug('DZ', 'alger-centre')?.code).toBe(ALGIERS.code);
    expect(findCityBySlug('DZ', ALGIERS.slug)?.code).toBe(ALGIERS.code);
    expect(findCityBySlug('DZ', 'not-a-city')).toBeUndefined();
  });

  it('treats an empty or whitespace query as no search', () => {
    expect(searchLocations('DZ', '')).toEqual([]);
    expect(searchLocations('DZ', '   ')).toEqual([]);
  });

  it('ranks city-name matches above state-only matches', () => {
    const results = searchLocations('DZ', 'Oran');
    expect(results.length).toBeGreaterThan(0);
    const firstStateOnly = results.findIndex(
      (r) => !r.city.name.toLowerCase().includes('oran'),
    );
    const lastCityHit = results.reduce(
      (last, r, i) => (r.city.name.toLowerCase().includes('oran') ? i : last),
      -1,
    );
    if (firstStateOnly !== -1) expect(lastCityHit).toBeLessThan(firstStateOnly);
  });

  it('matches Arabic names as written', () => {
    const results = searchLocations('DZ', 'الجزائر');
    expect(results.some((r) => r.city.code === ALGIERS.code)).toBe(true);
  });

  it('honours the result limit', () => {
    expect(searchLocations('DZ', 'a', 5)).toHaveLength(5);
    expect(searchLocations('DZ', 'a').length).toBeLessThanOrEqual(20);
  });

  it('carries the parent state with every result', () => {
    for (const result of searchLocations('DZ', 'Algiers', 5)) {
      expect(result.state.code).toBe(result.city.stateCode);
    }
  });
});
