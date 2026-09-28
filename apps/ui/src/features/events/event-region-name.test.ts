import { describe, expect, it } from 'vitest';

import type { Locale } from '@founders-coffee/i18n';

import { eventRegionName } from './event-region-name';

const cairo = {
  stateName: 'Cairo',
  stateNameAr: 'القاهرة',
  stateNameFr: 'Le Caire',
};

describe('what an event calls its region', () => {
  it.each<[Locale, string]>([
    ['ar', 'القاهرة'],
    ['en', 'Cairo'],
    ['fr', 'Le Caire'],
  ])('names it to a reader in %s as %s', (locale, name) => {
    expect(eventRegionName(cairo, locale)).toBe(name);
  });

  it('falls back to the Latin name where the region has none of its own', () => {
    expect(eventRegionName({ ...cairo, stateNameFr: null }, 'fr')).toBe(
      'Cairo',
    );
  });

  it('names none when the region is not in the dataset', () => {
    expect(
      eventRegionName(
        { stateName: null, stateNameAr: null, stateNameFr: null },
        'ar',
      ),
    ).toBeNull();
  });
});
