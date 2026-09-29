import { describe, expect, it } from 'vitest';

import { LOCALES } from '@founders-coffee/i18n';

import { KEYS, publishedText } from './pages.fixtures';

const LAW_BY_NUMBER =
  /\b\d{2}-\d{2}\b|\b(?:articles?|art\.)\s*\d|الماد(?:ة|تين)\s*\d/iu;

const COUNTRY =
  /alg[eé]ri|[ée]gypt|saudi|saoudite|الجزائر|جزائري|(?<![\p{L}\p{M}])[وبلف]?مصر(?![\p{L}\p{M}])|السعودي/iu;

const PAGES_FOR_EVERY_MARKET = [
  'about',
  'community',
  'contact',
  'cookies',
  'organizers',
] as const;

describe('the company pages, read from any market', () => {
  it('names no country on a page written for members in every market', () => {
    for (const key of PAGES_FOR_EVERY_MARKET) {
      for (const locale of LOCALES) {
        for (const text of publishedText(key, locale)) {
          expect(
            text,
            `${key}:${locale} names a country, so a member elsewhere reads rules or facts written for someone else`,
          ).not.toMatch(COUNTRY);
        }
      }
    }
  });

  it('cites no law or article by its number', () => {
    for (const key of KEYS) {
      for (const locale of LOCALES) {
        for (const text of publishedText(key, locale)) {
          expect(
            text,
            `${key}:${locale} cites a law by number, which tells a member in Egypt or Saudi Arabia nothing and ties the page to one country's statute book`,
          ).not.toMatch(LAW_BY_NUMBER);
        }
      }
    }
  });
});
