import { describe, expect, it } from 'vitest';

import { baseLocale, locales } from './paraglide/runtime.js';
import { DEFAULT_LOCALE, LOCALES, direction } from './locale.js';

describe('libs/i18n locale', () => {
  it('exposes the three language-level locales', () => {
    expect([...LOCALES]).toEqual(['ar', 'en', 'fr']);
  });

  it('defaults to Arabic (baseLocale)', () => {
    expect(DEFAULT_LOCALE).toBe('ar');
  });

  it('maps each locale to its layout direction', () => {
    expect(direction('ar')).toBe('rtl');
    expect(direction('en')).toBe('ltr');
    expect(direction('fr')).toBe('ltr');
  });

  it('agrees with the compiled Paraglide project', () => {
    expect([...LOCALES].sort()).toEqual([...locales].sort());
    expect(DEFAULT_LOCALE).toBe(baseLocale);
  });
});
