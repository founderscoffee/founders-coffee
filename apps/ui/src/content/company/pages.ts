import type { Locale } from '@founders-coffee/i18n';

import { aboutContent } from './about';
import { communityContent } from './community';
import { contactContent } from './contact';
import { cookiesContent } from './cookies';
import { faqContent } from './faq';
import { legalContent } from './legal';
import { organizersContent } from './organizers';
import { privacyContent } from './privacy';
import { termsContent } from './terms';
import type { CompanyPageContent, RelatedKey } from './types';

export type CompanyPageEntry =
  | {
      readonly kind: 'localized';
      readonly content: Record<Locale, CompanyPageContent>;
      readonly related: readonly RelatedKey[];
      readonly emailActions?: boolean;
      readonly faq?: boolean;
    }
  | {
      readonly kind: 'arabic';
      readonly content: CompanyPageContent;
      readonly related: readonly RelatedKey[];
    };

export const COMPANY_PAGES = {
  about: {
    kind: 'localized',
    content: aboutContent,
    related: ['terms', 'privacy', 'community'],
  },
  contact: {
    kind: 'localized',
    content: contactContent,
    related: ['privacy', 'terms', 'legal'],
    emailActions: true,
  },
  faq: {
    kind: 'localized',
    content: faqContent,
    related: ['terms', 'privacy', 'community'],
    faq: true,
  },
  terms: {
    kind: 'arabic',
    content: termsContent,
    related: ['privacy', 'community', 'organizers'],
  },
  privacy: {
    kind: 'arabic',
    content: privacyContent,
    related: ['cookies', 'terms', 'legal'],
  },
  cookies: {
    kind: 'arabic',
    content: cookiesContent,
    related: ['privacy', 'terms'],
  },
  community: {
    kind: 'arabic',
    content: communityContent,
    related: ['terms', 'organizers'],
  },
  organizers: {
    kind: 'arabic',
    content: organizersContent,
    related: ['terms', 'community', 'privacy'],
  },
  legal: {
    kind: 'arabic',
    content: legalContent,
    related: ['terms', 'privacy'],
  },
} as const satisfies Record<string, CompanyPageEntry>;

export type CompanyPageKey = keyof typeof COMPANY_PAGES;

export const isCompanyPageKey = (value: string): value is CompanyPageKey =>
  value in COMPANY_PAGES;

/** Content for a company page, falling back to the authoritative Arabic text. */
export const companyPageContent = (
  key: CompanyPageKey,
  locale: Locale,
): CompanyPageContent => {
  const entry: CompanyPageEntry = COMPANY_PAGES[key];
  return entry.kind === 'arabic' ? entry.content : entry.content[locale];
};

export type LegalPageKey = {
  [K in CompanyPageKey]: (typeof COMPANY_PAGES)[K]['kind'] extends 'arabic'
    ? K
    : never;
}[CompanyPageKey];

/** Routed legal documents, in the order they should be offered to readers. */
export const LEGAL_PAGE_KEYS = (
  Object.keys(COMPANY_PAGES) as CompanyPageKey[]
).filter((key): key is LegalPageKey => COMPANY_PAGES[key].kind === 'arabic');
