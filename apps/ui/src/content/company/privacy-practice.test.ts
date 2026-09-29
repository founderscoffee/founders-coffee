import { describe, expect, it } from 'vitest';

import { host_locate_me, LOCALES, type Locale } from '@founders-coffee/i18n';

import { companyPageContent } from './pages';
import type { CompanyBlock } from './types';

const COLLECTED = 'ما نجمعه ولماذا';
const SHARING = 'من يطّلع على بياناتك';
const TRANSFERS = 'نقل البيانات خارج بلدك';

const CONSENT: Record<Locale, RegExp> = {
  ar: /موافق/u,
  en: /consent/iu,
  fr: /consent/iu,
};

const DATABASE_REGION: Record<Locale, RegExp> = {
  ar: /أوروبا الغربية/u,
  en: /Western Europe/u,
  fr: /Europe de l’Ouest/u,
};

const PHONE: Record<Locale, string> = {
  ar: '**رقم الهاتف**',
  en: '**Phone number**',
  fr: '**Le numéro de téléphone**',
};

const SERVICES: Record<Locale, readonly string[]> = {
  ar: [
    'Cloudflare',
    'Mapbox',
    'Firebase',
    'Twilio',
    'Google',
    'GitHub',
    'تيليغرام',
  ],
  en: [
    'Cloudflare',
    'Mapbox',
    'Firebase',
    'Twilio',
    'Google',
    'GitHub',
    'Telegram',
  ],
  fr: [
    'Cloudflare',
    'Mapbox',
    'Firebase',
    'Twilio',
    'Google',
    'GitHub',
    'Telegram',
  ],
};

const blockText = (block: CompanyBlock): string =>
  block.kind === 'table'
    ? [...block.columns, ...block.rows.flat()].join(' ')
    : block.kind === 'list'
      ? block.items.join(' ')
      : block.text;

const sectionBlocks = (heading: string, locale: Locale): readonly string[] => {
  const index = companyPageContent('privacy', 'ar').sections.findIndex(
    (section) => section.heading === heading,
  );
  const section = companyPageContent('privacy', locale).sections[index];
  expect(section, `privacy has no section "${heading}"`).toBeDefined();
  return section?.blocks.map(blockText) ?? [];
};

const sectionText = (heading: string, locale: Locale): string =>
  sectionBlocks(heading, locale).join(' ');

describe('the privacy policy, held to what the platform does', () => {
  it('rests transfers abroad on no consent that sign-up never asks for', () => {
    for (const locale of LOCALES) {
      expect(
        sectionText(TRANSFERS, locale),
        `privacy:${locale} bases transfers abroad on the member's consent, but sign-up collects none`,
      ).not.toMatch(CONSENT[locale]);
    }
  });

  it('says where the database keeps its main copy', () => {
    for (const locale of LOCALES) {
      expect(
        sectionText(TRANSFERS, locale),
        `privacy:${locale} does not say where the database is; production reports its region as Western Europe (WEUR)`,
      ).toMatch(DATABASE_REGION[locale]);
    }
  });

  it('names every service that members’ data passes through', () => {
    for (const locale of LOCALES) {
      const sharing = sectionText(SHARING, locale);
      for (const service of SERVICES[locale]) {
        expect(
          sharing,
          `privacy:${locale} does not say what ${service} receives`,
        ).toContain(service);
      }
    }
  });

  it('says what “Locate me” does with the location the browser gives it', () => {
    for (const locale of LOCALES) {
      const button = host_locate_me({}, { locale });
      expect(
        sectionText(COLLECTED, locale),
        `privacy:${locale} never mentions the “${button}” button, which asks the browser for the member's location`,
      ).toContain(button);
    }
  });

  it('says who texts the code that confirms a phone number', () => {
    for (const locale of LOCALES) {
      expect(
        sectionBlocks(COLLECTED, locale).find((text) =>
          text.startsWith(PHONE[locale]),
        ),
        `privacy:${locale} does not say that the phone number goes to Twilio, which texts the code`,
      ).toContain('Twilio');
    }
  });
});
