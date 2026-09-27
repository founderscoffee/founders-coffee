import { describe, expect, it } from 'vitest';

import { LOCALES } from '@founders-coffee/i18n';

import { xDefaultLocale } from './seo-alternates';

describe('the language an unmatched reader is answered in', () => {
  it('is the base locale wherever the page is published in it', () => {
    expect(xDefaultLocale(LOCALES)).toBe('ar');
    expect(xDefaultLocale(['fr', 'ar'])).toBe('ar');
  });

  it('is the one language a single-language document has', () => {
    expect(
      xDefaultLocale(['ar']),
      'a single-language page keeps its only published language as the default',
    ).toBe('ar');
    expect(xDefaultLocale(['en'])).toBe('en');
  });

  it('never names a language the page does not advertise', () => {
    expect(
      xDefaultLocale(['en', 'fr']),
      'pointing x-default at a language with no alternate beside it sends a reader to an address the page never claimed to have',
    ).toBe('en');
  });

  it('falls back to the base locale when told of no languages at all', () => {
    expect(xDefaultLocale([])).toBe('ar');
  });
});
