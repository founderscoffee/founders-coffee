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

  it('names the capital apart from the country and the wilaya that share its word', () => {
    const city = findCity('DZ', ALGIERS.code);
    const wilaya = findState('DZ', ALGIERS.stateCode);
    expect(city?.nameAr).toBe('الجزائر العاصمة');
    expect(city?.nameAr).not.toBe(wilaya?.nameAr);
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

describe('French place names', () => {
  const everyPlace = (country: string) => [
    ...getStates(country),
    ...getStates(country).flatMap((state) => getCities(country, state.code)),
  ];

  it('calls the Algerian capital Alger, the way the French pages have to', () => {
    expect(findCity('DZ', ALGIERS.code)?.nameFr).toBe('Alger');
    expect(
      findCity('EG', findCityBySlug('EG', 'cairo')?.code ?? '')?.nameFr,
    ).toBe('Le Caire');
  });

  it('finds a place under the name only French calls it', () => {
    const city = searchLocations('EG', 'Charm el-Cheikh');
    expect(
      city.some((r) => r.city.name === 'Sharm El-Shaikh'),
      'a French reader typing back the city name they were just shown finds nothing',
    ).toBe(true);

    const governorate = searchLocations('EG', 'Mer Rouge');
    expect(
      governorate.length,
      'a French reader searching the governorate by its French name finds nothing',
    ).toBeGreaterThan(0);
    expect(governorate.every((r) => r.state.name === 'Red Sea')).toBe(true);
  });

  it('gives a featured Algerian city the French its own wilaya already carried', () => {
    for (const city of getFeaturedCities('DZ')) {
      const wilaya = findState('DZ', city.stateCode);
      const differs = wilaya !== undefined && wilaya.name !== city.name;
      expect(
        city.nameFr,
        `${city.name} sits in wilaya ${wilaya?.name}, which DZ_STATES already spells in French`,
      ).toBe(differs ? wilaya.name : undefined);
    }
  });

  it('carries a French name only where French has a different word', () => {
    for (const country of ['DZ', 'EG', 'SA']) {
      for (const place of everyPlace(country)) {
        if (place.nameFr === undefined) continue;
        expect(place.nameFr.trim(), `${country} ${place.name}`).not.toBe('');
        expect(
          place.nameFr,
          `${country} ${place.name} repeats itself in nameFr, where absent says the same thing`,
        ).not.toBe(place.name);
      }
    }
  });
});
