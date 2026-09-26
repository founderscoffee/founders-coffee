import { describe, expect, it } from 'vitest';

import type { UpcomingCityHost } from '@founders-coffee/db';

import { groupCityHosts } from './city-hosts.js';

const row = (
  cityCode: string,
  hostId: string,
  name = `Host ${hostId}`,
  photoAssetId: string | null = null,
): UpcomingCityHost => ({ cityCode, hostId, name, photoAssetId });

describe('the hosts a city card shows', () => {
  it('draws the first three hosts in the order given and counts every one', () => {
    const cities = groupCityHosts([
      row('16', 'usr_a', 'Amina', 'ast_a'),
      row('16', 'usr_b', 'Bilal'),
      row('16', 'usr_c', 'Chahra', 'ast_c'),
      row('16', 'usr_d', 'Djamel'),
      row('16', 'usr_e', 'Elias'),
    ]);

    expect(cities.get('16')).toEqual({
      hosts: [
        { name: 'Amina', photoAssetId: 'ast_a' },
        { name: 'Bilal', photoAssetId: null },
        { name: 'Chahra', photoAssetId: 'ast_c' },
      ],
      hostCount: 5,
    });
  });

  it('keeps each city’s hosts to that city', () => {
    const cities = groupCityHosts([
      row('16', 'usr_a', 'Amina'),
      row('31', 'usr_a', 'Amina'),
      row('31', 'usr_b', 'Bilal'),
    ]);

    expect(cities.get('16')).toEqual({
      hosts: [{ name: 'Amina', photoAssetId: null }],
      hostCount: 1,
    });
    expect(cities.get('31')).toEqual({
      hosts: [
        { name: 'Amina', photoAssetId: null },
        { name: 'Bilal', photoAssetId: null },
      ],
      hostCount: 2,
    });
    expect(cities.has('25')).toBe(false);
  });

  it('counts a host it has no name to draw, and draws the next one instead', () => {
    const cities = groupCityHosts([
      row('16', 'usr_blank', '   ', 'ast_blank'),
      row('16', 'usr_long', 'ا'.repeat(81)),
      row('16', 'usr_a', 'Amina'),
      row('16', 'usr_b', 'Bilal'),
      row('16', 'usr_c', 'Chahra'),
    ]);

    expect(cities.get('16')).toEqual({
      hosts: [
        { name: 'Amina', photoAssetId: null },
        { name: 'Bilal', photoAssetId: null },
        { name: 'Chahra', photoAssetId: null },
      ],
      hostCount: 5,
    });
  });

  it('draws the name the way a public profile shows it', () => {
    const cities = groupCityHosts([row('16', 'usr_a', '  ياسين بن علي  ')]);

    expect(cities.get('16')?.hosts).toEqual([
      { name: 'ياسين بن علي', photoAssetId: null },
    ]);
  });
});
