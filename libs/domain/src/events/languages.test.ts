import { describe, expect, it } from 'vitest';

import { eventLanguagesSchema, leadLocale } from './languages.js';

describe('the languages a meetup is held in', () => {
  it('may be several, including ones the site has no pages in', () => {
    expect(eventLanguagesSchema.parse(['ar', 'fr', 'ber'])).toEqual([
      'ar',
      'fr',
      'ber',
    ]);
  });

  it('are at least one, each named once', () => {
    expect(eventLanguagesSchema.safeParse([]).success).toBe(false);
    expect(eventLanguagesSchema.safeParse(['ar', 'ar']).success).toBe(false);
    expect(eventLanguagesSchema.safeParse(['xx']).success).toBe(false);
  });
});

describe('the language the site writes in about a meetup', () => {
  it('is the first one the host listed that the site is written in', () => {
    expect(leadLocale(['fr', 'ar'], 'ar')).toBe('fr');
    expect(
      leadLocale(['ber', 'en'], 'ar'),
      'the stored address and the calendar entry need a language the site has, so Tamazight is passed over for English',
    ).toBe('en');
  });

  it('falls back when the host listed none of them', () => {
    expect(leadLocale(['ber'], 'ar')).toBe('ar');
    expect(leadLocale(['es', 'de'], 'fr')).toBe('fr');
  });
});
