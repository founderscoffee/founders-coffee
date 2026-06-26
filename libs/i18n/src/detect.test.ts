import { describe, expect, it } from 'vitest';

import { cookieName } from './paraglide/runtime.js';
import { detectLocale } from './detect.js';

const cookie = (locale: string) => `${cookieName}=${locale}`;

describe('libs/i18n detectLocale', () => {
  it('uses the cookie locale when present', () => {
    expect(detectLocale(cookie('fr'), null)).toBe('fr');
    expect(detectLocale(cookie('en'), null)).toBe('en');
  });

  it('ignores an invalid cookie value', () => {
    expect(detectLocale(`${cookieName}=de`, 'ar')).toBe('ar');
  });

  it('falls back to Accept-Language (q-value ranked, region stripped)', () => {
    expect(detectLocale(null, 'fr-FR')).toBe('fr');
    expect(detectLocale(null, 'en-US,en;q=0.9')).toBe('en');
    expect(detectLocale(null, 'fr;q=0.8,ar;q=0.9')).toBe('ar');
  });

  it('falls back to the base locale (ar) when nothing matches', () => {
    expect(detectLocale(null, null)).toBe('ar');
    expect(detectLocale(null, 'de,es')).toBe('ar');
  });

  it('prefers the cookie over Accept-Language', () => {
    expect(detectLocale(cookie('fr'), 'en')).toBe('fr');
  });
});
