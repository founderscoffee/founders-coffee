import { describe, expect, it } from 'vitest';

import { events } from '@founders-coffee/domain';

import { hostCreateStepCopy, hostCreateViewCopy } from './host-create-copy';

describe('host create copy', () => {
  it.each(['ar', 'fr', 'en'] as const)(
    'provides complete step copy in %s',
    (locale) => {
      const stepCopy = hostCreateStepCopy(locale, 'Algiers');

      expect(stepCopy.labels).toHaveLength(3);
      expect(stepCopy.titles).toHaveLength(3);
      expect(stepCopy.descriptions).toHaveLength(3);
      expect(stepCopy.labels.every(Boolean)).toBe(true);
      expect(stepCopy.titles.every(Boolean)).toBe(true);
      expect(stepCopy.descriptions.every(Boolean)).toBe(true);
    },
  );

  it('carries the schema-owned constraints the details step enforces', () => {
    expect(hostCreateViewCopy().constraints).toEqual({
      titleMin: events.EVENT_TITLE_MIN_LENGTH,
      titleMax: events.EVENT_TITLE_MAX_LENGTH,
      descriptionMin: events.EVENT_DESCRIPTION_MIN_LENGTH,
      descriptionMax: events.EVENT_DESCRIPTION_MAX_LENGTH,
    });
  });
});
