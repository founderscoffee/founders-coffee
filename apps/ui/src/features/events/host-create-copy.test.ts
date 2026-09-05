import { describe, expect, it } from 'vitest';

import { events } from '@founders-coffee/domain';
import { LOCALES } from '@founders-coffee/i18n';

import {
  eventCategoryLabel,
  eventLanguageLabel,
  hostCreateStepCopy,
  hostCreateViewCopy,
} from './host-create-copy';

describe('host create copy', () => {
  it.each(['ar', 'fr', 'en'] as const)(
    'provides complete option and step copy in %s',
    (locale) => {
      const stepCopy = hostCreateStepCopy(locale, 'Algiers');
      const view = hostCreateViewCopy(locale, 'ar', 'coffee-meetup');

      expect(stepCopy.labels).toHaveLength(3);
      expect(stepCopy.titles).toHaveLength(3);
      expect(stepCopy.descriptions).toHaveLength(3);
      expect(stepCopy.labels.every(Boolean)).toBe(true);
      expect(stepCopy.titles.every(Boolean)).toBe(true);
      expect(stepCopy.descriptions.every(Boolean)).toBe(true);
      expect(view.languageOptions.map(({ value }) => value)).toEqual(LOCALES);
      expect(view.categoryOptions.map(({ value }) => value)).toEqual(
        events.EVENT_CATEGORIES,
      );
      expect(view.languageOptions.every(({ label }) => label.length > 0)).toBe(
        true,
      );
      expect(view.categoryOptions.every(({ label }) => label.length > 0)).toBe(
        true,
      );
    },
  );

  it('labels every schema-owned language and category', () => {
    for (const language of LOCALES) {
      expect(eventLanguageLabel(language, 'en')).toBeTruthy();
    }
    for (const category of events.EVENT_CATEGORIES) {
      expect(eventCategoryLabel(category, 'en')).toBeTruthy();
    }
  });
});
