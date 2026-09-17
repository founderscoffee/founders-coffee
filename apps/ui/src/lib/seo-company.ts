import { LOCALES, type Locale } from '@founders-coffee/i18n';

import { CONTACT_EMAIL } from '../content/company';

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
  readonly title: string;
  readonly description: string;
};

/** Shared metadata and WebPage JSON-LD for company pages. */
export const companyPageHead = ({
  locale,
  path,
  canonicalLocale,
  title,
  description,
}: CompanyHeadInput) => {
  const siteOrigin = getSiteOrigin();
  const route: CanonicalRoute = {
    type: 'company',
    path,
    locale: canonicalLocale,
  };
  const url = canonicalUrl(route);
  const metadata = buildPageMetadata({
    locale,
    title,
    description,
    route,
  });

  return {
    ...metadata,
    scripts: [
      {
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
      },
    ],
  };
};
