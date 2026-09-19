import { LOCALES, type Locale } from '@founders-coffee/i18n';

import { CONTACT_EMAIL, type CompanyPageContent } from '../content/company';

import { faqJsonLd } from './faq-jsonld';

import {
  buildPageMetadata,
  canonicalUrl,
  getSiteOrigin,
  type CanonicalRoute,
} from './seo';

export const organizationJsonLd = () =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Founders Coffee',
    url: getSiteOrigin(),
    logo: `${getSiteOrigin()}/android-chrome-512x512.png`,
    email: CONTACT_EMAIL,
    description: 'Local founder communities that meet over coffee.',
    contactPoint: [
      {
        '@type': 'ContactPoint',
        email: CONTACT_EMAIL,
        contactType: 'customer support',
        availableLanguage: [...LOCALES],
      },
    ],
  });

type CompanyHeadInput = {
  readonly locale: Locale;
  readonly path: string;
  readonly canonicalLocale?: Locale;
  readonly soleLocale?: Locale;
  readonly title: string;
  readonly description: string;
  readonly faq?: CompanyPageContent;
};

/**
 * Shared metadata and WebPage JSON-LD for company pages.
 *
 * `soleLocale` marks a document that exists in one language only. Every locale
 * serves the same bytes, so all three URLs canonicalise to that language's URL
 * and no alternate is advertised: three self-canonical copies of one Arabic
 * document would compete with each other rather than consolidate.
 *
 * `faq` adds FAQPage structured data alongside the WebPage node, for pages
 * written as questions and answers.
 */
export const companyPageHead = ({
  locale,
  path,
  canonicalLocale,
  soleLocale,
  title,
  description,
  faq,
}: CompanyHeadInput) => {
  const siteOrigin = getSiteOrigin();
  const documentLocale = soleLocale ?? locale;
  const route: CanonicalRoute = {
    type: 'company',
    path,
    locale: soleLocale ?? canonicalLocale,
  };
  const url = canonicalUrl(route);
  const metadata = buildPageMetadata({
    locale: documentLocale,
    title,
    description,
    route,
    alternateLocales: soleLocale ? [soleLocale] : LOCALES,
  });

  const webPage = {
    type: 'application/ld+json',
    children: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: metadata.meta[0].title,
      description: metadata.meta[1].content,
      url,
      isPartOf: {
        '@type': 'WebSite',
        name: 'Founders Coffee',
        url: siteOrigin,
      },
      inLanguage: documentLocale,
    }),
  };

  return {
    ...metadata,
    scripts: faq
      ? [
          webPage,
          { type: 'application/ld+json', children: faqJsonLd(faq, url) },
        ]
      : [webPage],
  };
};
