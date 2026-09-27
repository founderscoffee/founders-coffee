import { LOCALES, llms_description, type Locale } from '@founders-coffee/i18n';

import { CONTACT_EMAIL, type CompanyPageContent } from '../content/company';

import { faqJsonLd } from './faq-jsonld';

import {
  buildPageMetadata,
  canonicalUrl,
  getSiteOrigin,
  type CanonicalRoute,
} from './seo';

export const organizationJsonLd = (locale: Locale) =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Founders Coffee',
    url: getSiteOrigin(),
    logo: `${getSiteOrigin()}/android-chrome-512x512.png`,
    email: CONTACT_EMAIL,
    description: llms_description({}, { locale }),
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
  readonly title: string;
  readonly description: string;
  readonly faq?: CompanyPageContent;
};

/**
 * Shared metadata and WebPage JSON-LD for company pages.
 *
 * `faq` adds FAQPage structured data alongside the WebPage node, for pages
 * written as questions and answers.
 */
export const companyPageHead = ({
  locale,
  path,
  canonicalLocale,
  title,
  description,
  faq,
}: CompanyHeadInput) => {
  const siteOrigin = getSiteOrigin();
  const route: CanonicalRoute = {
    type: 'company',
    path,
    locale: canonicalLocale ?? locale,
  };
  const url = canonicalUrl(route);
  const metadata = buildPageMetadata({
    locale,
    title,
    description,
    route,
    alternateLocales: LOCALES,
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
      inLanguage: locale,
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
