import { describe, expect, it } from 'vitest';

import { events } from '@founders-coffee/domain';

import { hostCreateStepCopy, hostCreateViewCopy } from './host-create-copy';

describe('host create copy', () => {
  it.each(['ar', 'fr', 'en'] as const)(
    'provides complete step copy in %s',
    (locale) => {
      const stepCopy = hostCreateStepCopy(locale, {
        kind: 'city',
        name: 'Algiers',
      });

      expect(stepCopy.labels).toHaveLength(3);
      expect(stepCopy.titles).toHaveLength(3);
      expect(stepCopy.descriptions).toHaveLength(3);
      expect(stepCopy.labels.every(Boolean)).toBe(true);
      expect(stepCopy.titles.every(Boolean)).toBe(true);
      expect(stepCopy.descriptions.every(Boolean)).toBe(true);
    },
  );

  it('places the venues in the city, merging à into the article of Le Caire', () => {
    expect(
      hostCreateStepCopy('fr', { kind: 'city', name: 'Le Caire' })
        .descriptions[0],
    ).toBe('Cafés et espaces de coworking au Caire.');
  });

  it('places the venues in the country with en when the host has not picked a city', () => {
    expect(
      hostCreateStepCopy('fr', { kind: 'market', name: 'Égypte' })
        .descriptions[0],
      'the wizard opened from the navbar put the country where the city goes, "à Égypte"',
    ).toBe('Cafés et espaces de coworking en Égypte.');
    expect(
      hostCreateStepCopy('en', { kind: 'market', name: 'Egypt' })
        .descriptions[0],
    ).toBe('Cafés and coworking spaces in Egypt.');
  });

  it('carries the schema-owned constraints the details step enforces', () => {
    expect(hostCreateViewCopy().constraints).toEqual({
      titleMin: events.EVENT_TITLE_MIN_LENGTH,
      titleMax: events.EVENT_TITLE_MAX_LENGTH,
      descriptionMin: events.EVENT_DESCRIPTION_MIN_LENGTH,
      descriptionMax: events.EVENT_DESCRIPTION_MAX_LENGTH,
      venueNameMax: events.EVENT_VENUE_NAME_MAX_LENGTH,
    });
  });
});
