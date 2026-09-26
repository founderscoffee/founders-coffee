import { describe, expect, it } from 'vitest';

import { events } from '@founders-coffee/domain';

import { hostCreateStepCopy, hostCreateViewCopy } from './host-create-copy';

describe('host create copy', () => {
  it.each(['ar', 'fr', 'en'] as const)(
    'provides complete step copy in %s',
    (locale) => {
      const stepCopy = hostCreateStepCopy(locale);

      expect(stepCopy.labels).toHaveLength(3);
      expect(stepCopy.titles).toHaveLength(3);
      expect(stepCopy.descriptions).toHaveLength(3);
      expect(stepCopy.labels.every(Boolean)).toBe(true);
      expect(stepCopy.titles.every(Boolean)).toBe(true);
      expect(stepCopy.descriptions.slice(1).every(Boolean)).toBe(true);
    },
  );

  it('leaves the venue step without a subtitle, since the search box already says what to look for and where', () => {
    expect(
      hostCreateStepCopy('en').descriptions[0],
      'the subtitle repeated the placeholder under it and pushed the map down on a phone (#121)',
    ).toBeNull();
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
