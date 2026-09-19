import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { readGeoRecords } from './geo-records.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const source = (market) =>
  readFileSync(`${ROOT}libs/domain/src/geo/data/${market}.ts`, 'utf8');

const MODULE = `
export const XX_CITIES: readonly GeoCity[] = [
  {
    code: '1',
    name: 'Plain',
    nameAr: 'سهل',
    slug: 'plain',
    stateCode: '01',
    featured: true,
  },
  {
    code: '2',
    name: "M'sila",
    nameAr: 'المسيلة',
    slug: 'm-sila',
    stateCode: '02',
    featured: false,
  },
];
`;

describe('readGeoRecords', () => {
  it('reads a name however prettier chose to quote it', () => {
    expect(readGeoRecords(MODULE, 'XX_CITIES').map((c) => c.name)).toEqual([
      'Plain',
      "M'sila",
    ]);
  });

  it('reads booleans as booleans', () => {
    expect(readGeoRecords(MODULE, 'XX_CITIES').map((c) => c.featured)).toEqual([
      true,
      false,
    ]);
  });

  it('survives a field being added, and carries it through', () => {
    const grown = MODULE.replace(
      "nameAr: 'سهل',",
      "nameAr: 'سهل',\n    nameFr: 'Plaine',",
    );
    const records = readGeoRecords(grown, 'XX_CITIES');
    expect(records).toHaveLength(2);
    expect(records[0].nameFr).toBe('Plaine');
    expect(records[0].slug).toBe('plain');
  });

  it('survives the field order changing', () => {
    const reordered = MODULE.replace(
      "    code: '1',\n    name: 'Plain',",
      "    name: 'Plain',\n    code: '1',",
    );
    const [first] = readGeoRecords(reordered, 'XX_CITIES');
    expect(first.code).toBe('1');
    expect(first.name).toBe('Plain');
  });

  it('says which export it could not find rather than reading nothing', () => {
    expect(() => readGeoRecords(MODULE, 'XX_STATES')).toThrow('XX_STATES');
  });

  it('sees every featured city the shipped Algerian data declares', () => {
    const cities = readGeoRecords(source('dz'), 'DZ_CITIES');
    const featured = cities.filter((city) => city.featured);
    expect(featured).toHaveLength(58);
    expect(featured.map((city) => city.name)).toContain("M'sila");
    expect(featured.map((city) => city.name)).toContain("El-M'ghaier");
  });

  it('reads the states of every shipped market', () => {
    for (const [market, count] of [
      ['dz', 58],
      ['eg', 27],
      ['sa', 13],
    ]) {
      const states = readGeoRecords(
        source(market),
        `${market.toUpperCase()}_STATES`,
      );
      expect(states, market).toHaveLength(count);
      for (const state of states) {
        expect(state.code, `${market} ${state.name}`).toBeTruthy();
        expect(state.name, `${market} ${state.code}`).toBeTruthy();
        expect(state.nameAr, `${market} ${state.code}`).toBeTruthy();
      }
    }
  });
});
