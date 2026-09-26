import { describe, expect, it } from 'vitest';

import type { Locale } from '@founders-coffee/i18n';

import { eventCityName } from './event-city-name';

const algiers = {
  cityName: 'Algiers',
  cityNameAr: 'الجزائر العاصمة',
  cityNameFr: 'Alger',
};

describe('what an event calls its city', () => {
  it.each<[Locale, string]>([
    ['ar', 'الجزائر العاصمة'],
    ['en', 'Algiers'],
    ['fr', 'Alger'],
  ])('names it to a reader in %s as %s', (locale, name) => {
    expect(eventCityName(algiers, locale)).toBe(name);
  });
});
