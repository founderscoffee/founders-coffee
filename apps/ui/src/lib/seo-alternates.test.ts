import { describe, expect, it } from 'vitest';

import { LOCALES } from '@founders-coffee/i18n';

import { localeAlternates } from './seo';
import {
  openGraphAlternates,
  openGraphLocale,
  xDefaultLocale,
} from './seo-alternates';
import { marketAlternates } from './seo-market';

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

describe('the locale a page tells Open Graph it is in', () => {
  it("names the market's country on a page that belongs to one", () => {
    expect(openGraphLocale('ar', 'EG')).toBe('ar_EG');
    expect(openGraphLocale('fr', 'SA')).toBe('fr_SA');
    expect(openGraphLocale('en', 'DZ')).toBe('en_DZ');
  });

  it("keeps each language's own country on a page that belongs to none", () => {
    expect(openGraphLocale('ar')).toBe('ar_DZ');
    expect(openGraphLocale('fr')).toBe('fr_FR');
    expect(openGraphLocale('en')).toBe('en_US');
  });
});

describe('the languages a page tells Open Graph it is also in', () => {
  it('reads both other languages off the page’s hreflang links', () => {
    const links = localeAlternates({
      type: 'company',
      path: '/about',
      locale: 'fr',
    });

    expect(
      openGraphAlternates(links, 'fr'),
      'only the last of the two alternates reached the page when they went through head()',
    ).toEqual(['ar_DZ', 'en_US']);
    expect(openGraphAlternates(links, 'ar')).toEqual(['en_US', 'fr_FR']);
  });

  it('names no language for x-default or for links of another kind', () => {
    expect(
      openGraphAlternates(
        [
          { rel: 'canonical' },
          { rel: 'alternate', hrefLang: 'x-default' },
          { rel: 'stylesheet' },
          undefined,
        ],
        'ar',
      ),
    ).toEqual([]);
  });

  it('names none for a page published in one language', () => {
    expect(
      openGraphAlternates(
        localeAlternates({ type: 'company', path: '/about' }, ['ar']),
        'ar',
      ),
    ).toEqual([]);
  });

  it("names the market's country on a page that belongs to one", () => {
    expect(
      openGraphAlternates(
        localeAlternates({
          type: 'city',
          market: 'egypt',
          city: 'cairo',
          locale: 'ar',
        }),
        'ar',
        'EG',
      ),
    ).toEqual(['en_EG', 'fr_EG']);
  });

  it("reads a landing page's languages off its bare links, not the ones that name a country", () => {
    const links = marketAlternates(
      [
        { code: 'DZ', slug: 'algeria' },
        { code: 'EG', slug: 'egypt' },
      ],
      'algeria',
    );

    expect(
      openGraphAlternates(links, 'fr', 'EG'),
      "the country-coded links list every market's copy, not this page's other languages",
    ).toEqual(['ar_EG', 'en_EG']);
  });
});
