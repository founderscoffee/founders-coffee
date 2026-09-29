import { describe, expect, it } from 'vitest';

import { LOCALES, type Locale } from '@founders-coffee/i18n';

import { companyPageContent } from './pages';
import type { CompanyBlock } from './types';

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

const blockText = (block: CompanyBlock): string =>
  block.kind === 'table'
    ? [...block.columns, ...block.rows.flat()].join(' ')
    : block.kind === 'list'
      ? block.items.join(' ')
      : block.text;

const sectionText = (heading: string, locale: Locale): string => {
  const index = companyPageContent('privacy', 'ar').sections.findIndex(
    (section) => section.heading === heading,
  );
  const section = companyPageContent('privacy', locale).sections[index];
  expect(section, `privacy has no section "${heading}"`).toBeDefined();
  return section?.blocks.map(blockText).join(' ') ?? '';
};

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
});
