import type { Locale } from '@founders-coffee/i18n';

import { aboutContent } from './about';
import { communityContent } from './community';
import { contactContent } from './contact';
import { cookiesContent } from './cookies';
import { faqContent } from './faq';
import { legalContent } from './legal';
import { legalEnglish } from './legal-en-legal';
import { communityEnglish } from './legal-en-community';
import { cookiesEnglish } from './legal-en-cookies';
import { organizersEnglish } from './legal-en-organizers';
import { privacyEnglish } from './legal-en-privacy';
import { termsEnglish } from './legal-en-terms';
import { legalFrench } from './legal-fr-legal';
import { communityFrench } from './legal-fr-community';
import { cookiesFrench } from './legal-fr-cookies';
import { organizersFrench } from './legal-fr-organizers';
import { privacyFrench } from './legal-fr-privacy';
import { termsFrench } from './legal-fr-terms';
import { organizersContent } from './organizers';
import { privacyContent } from './privacy';
import { termsContent } from './terms';
import type { CompanyPageContent, RelatedKey } from './types';

export type CompanyPageEntry = {
  readonly kind: 'localized';
  readonly content: Record<Locale, CompanyPageContent>;
  readonly related: readonly RelatedKey[];
  readonly emailActions?: boolean;
  readonly faq?: boolean;
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
    kind: 'localized',
    content: { ar: termsContent, en: termsEnglish, fr: termsFrench },
    related: ['privacy', 'community', 'organizers'],
  },
  privacy: {
    kind: 'localized',
    content: { ar: privacyContent, en: privacyEnglish, fr: privacyFrench },
    related: ['cookies', 'terms', 'legal'],
  },
  cookies: {
    kind: 'localized',
    content: { ar: cookiesContent, en: cookiesEnglish, fr: cookiesFrench },
    related: ['privacy', 'terms'],
  },
  community: {
    kind: 'localized',
    content: {
      ar: communityContent,
      en: communityEnglish,
      fr: communityFrench,
    },
    related: ['terms', 'organizers'],
  },
  organizers: {
    kind: 'localized',
    content: {
      ar: organizersContent,
      en: organizersEnglish,
      fr: organizersFrench,
    },
    related: ['terms', 'community', 'privacy'],
  },
  legal: {
    kind: 'localized',
    content: { ar: legalContent, en: legalEnglish, fr: legalFrench },
    related: ['terms', 'privacy'],
  },
} as const satisfies Record<string, CompanyPageEntry>;

export type CompanyPageKey = keyof typeof COMPANY_PAGES;

export const isCompanyPageKey = (value: string): value is CompanyPageKey =>
  value in COMPANY_PAGES;

/**
 * The company page a markdown link in the published text points at, or `null` for anything else.
 *
 * `RichText` used to carry its own list of the six legal paths, copied by hand from
 * `LEGAL_PAGE_KEYS`. The content test next door checks link targets against `isCompanyPageKey`,
 * which admits nine pages, so a link to `/faq`, `/about` or `/contact` passed the guard and then
 * fell through the renderer to reach the reader as literal `[label](/faq)`. The guard was the more
 * permissive of the two, which is the worst way round: it blessed precisely what could not render.
 *
 * Both sides resolve through here now, so the set of pages the content may link and the set the
 * renderer can draw are the same set. A target this cannot place renders as its label alone, never
 * as raw markup, and the content test fails the build before a reader meets one.
 */
export const companyLinkKey = (target: string): CompanyPageKey | null => {
  const key = target.startsWith('/') ? target.slice(1) : target;
  return isCompanyPageKey(key) ? key : null;
};

/** Content for a company page in the requested interface locale. */
export const companyPageContent = (
  key: CompanyPageKey,
  locale: Locale,
): CompanyPageContent => {
  const entry: CompanyPageEntry = COMPANY_PAGES[key];
  return entry.content[locale];
};

export type LegalPageKey =
  'terms' | 'privacy' | 'cookies' | 'community' | 'organizers' | 'legal';

/** Routed legal documents, in the order they should be offered to readers. */
export const LEGAL_PAGE_KEYS: readonly LegalPageKey[] = [
  'terms',
  'privacy',
  'cookies',
  'community',
  'organizers',
  'legal',
];
