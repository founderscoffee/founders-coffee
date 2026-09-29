import { describe, expect, it } from 'vitest';

import { LOCALES, type Locale } from '@founders-coffee/i18n';

import { KEYS, publishedText } from './pages.fixtures';

const LAW_BY_NUMBER =
  /\b\d{2}-\d{2}\b|\b(?:articles?|art\.)\s*\d|الماد(?:ة|تين)\s*\d/iu;

const COUNTRY =
  /alg[eé]ri|[ée]gypt|saudi|saoudite|الجزائر|جزائري|(?<![\p{L}\p{M}])[وبلف]?مصر(?![\p{L}\p{M}])|السعودي/iu;

const OPERATOR_LAW = /القانون الجزائري|algerian law|(?:droit|loi) algérien/iu;

const ONE_COUNTRYS_AUTHORITY =
  /ANPDP|السلطة الوطنية لحماية|national authority for the protection|autorité nationale de protection|PDPC|مركز حماية البيانات|protection cent(?:er|re)|SDAIA|سدايا/iu;

const STRICTEST_DEADLINES = [
  ['(72)', 'hours to report a breach to the authorities'],
  ['(3)', 'working days to then tell each member it touches'],
  ['(6)', 'working days to answer a request'],
] as const;

const MINIMUM_AGE = /\b19\b|تسعة عشر/u;

const NATIONALITY_AND_RESIDENCE: Record<Locale, readonly RegExp[]> = {
  ar: [/جنسيتها/u, /[تي]قيم فيها/u],
  en: [/nationality/u, /where (?:you|they) live/u],
  fr: [/nationalité/u, /résid/u],
};

const PAGES_FOR_EVERY_MARKET = [
  'about',
  'community',
  'contact',
  'cookies',
  'faq',
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

  it('names a country only as the law the operator works under', () => {
    for (const key of KEYS) {
      for (const locale of LOCALES) {
        const naming = publishedText(key, locale).filter((text) =>
          COUNTRY.test(text),
        );
        for (const text of naming) {
          expect(
            text,
            `${key}:${locale} ties a rule for members to one country; state one rule for every market, at the strictest market's level`,
          ).toMatch(OPERATOR_LAW);
        }
      }
    }
  });

  it("sends no member to one country's data protection authority", () => {
    for (const key of KEYS) {
      for (const locale of LOCALES) {
        for (const text of publishedText(key, locale)) {
          expect(
            text,
            `${key}:${locale} names one country's authority, while a member elsewhere reports to and complains to their own`,
          ).not.toMatch(ONE_COUNTRYS_AUTHORITY);
        }
      }
    }
  });

  it('holds every member to the shortest deadline any market sets', () => {
    for (const locale of LOCALES) {
      const privacy = publishedText('privacy', locale).join(' ');
      for (const [deadline, what] of STRICTEST_DEADLINES) {
        expect(
          privacy,
          `privacy:${locale} does not promise ${deadline} ${what}, the shortest of the markets we serve`,
        ).toContain(deadline);
      }
    }
  });

  it('sets the minimum age by the law of the nationality and of the residence', () => {
    for (const key of ['faq', 'privacy', 'terms'] as const) {
      for (const locale of LOCALES) {
        const rules = publishedText(key, locale).filter((text) =>
          MINIMUM_AGE.test(text),
        );
        expect(rules, `${key}:${locale} states no minimum age`).not.toEqual([]);
        for (const rule of rules) {
          for (const law of NATIONALITY_AND_RESIDENCE[locale]) {
            expect(
              rule,
              `${key}:${locale} leaves "your country" open, when majority turns on both the nationality and the residence`,
            ).toMatch(law);
          }
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
