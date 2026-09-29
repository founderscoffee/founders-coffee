import { LOCALES, llms_description, type Locale } from '@founders-coffee/i18n';

import { CONTACT_EMAIL, type CompanyPageContent } from '../content/company';

import { faqJsonLd } from './faq-jsonld';

import {
  buildPageMetadata,
  canonicalUrl,
  getSiteOrigin,
  SITE_NAME,
  type CanonicalRoute,
} from './seo';

/**
 * The site's `WebSite` node, which is where Google reads the name it prints above each result.
 *
 * Google reads it from the home page, and `/` is a redirect: it answers 307 with a market landing
 * chosen by the reader's country and language, and Google reads the page it lands on. So it goes
 * on every page, as the Organization does, and is there wherever `/` sends Googlebot. Without it
 * Google printed the bare domain, "founders.coffee".
 */
export const websiteJsonLd = () =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: `${getSiteOrigin()}/`,
  });

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
