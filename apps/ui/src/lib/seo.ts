import type { Locale } from '@founders-coffee/i18n';
import { getRequestContext } from '@founders-coffee/observability/context';

import { CONTACT_EMAIL } from '../content/company';

import { PRODUCTION_ORIGIN } from './indexation';

export const SITE_ORIGIN = PRODUCTION_ORIGIN;

export const getSiteOrigin = (): string => {
  const requestOrigin = getRequestContext().siteOrigin;
  if (requestOrigin) return requestOrigin;
  if (typeof window !== 'undefined') return window.location.origin;
  return SITE_ORIGIN;
};

export const organizationJsonLd = () =>
  JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'founders.coffee',
    url: getSiteOrigin(),
    logo: `${getSiteOrigin()}/logo-fc.svg`,
    email: CONTACT_EMAIL,
    description: 'Local founder communities that meet over coffee.',
    sameAs: [],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        email: CONTACT_EMAIL,
        contactType: 'customer support',
        availableLanguage: ['ar', 'en', 'fr'],
      },
    ],
  });

type CompanyHeadInput = {
  locale: Locale;
  path: string;
  title: string;
  description: string;
};

/** Shared meta + WebPage JSON-LD for About / Contact / Privacy / Terms / Cookies. */
export const companyPageHead = ({
  locale,
  path,
  title,
  description,
}: CompanyHeadInput) => {
  const siteOrigin = getSiteOrigin();
  const url = `${siteOrigin}${path}`;
  const fullTitle = `${title} - founders.coffee`;

  return {
    meta: [
      { title: fullTitle },
      { name: 'description', content: description },
      { name: 'robots', content: 'index,follow' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'founders.coffee' },
      { property: 'og:title', content: fullTitle },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
      {
        property: 'og:locale',
        content:
          locale === 'ar' ? 'ar_DZ' : locale === 'fr' ? 'fr_FR' : 'en_US',
      },
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: fullTitle },
      { name: 'twitter:description', content: description },
    ],
    links: [{ rel: 'canonical', href: url }],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: fullTitle,
          description,
          url,
          isPartOf: {
            '@type': 'WebSite',
            name: 'founders.coffee',
            url: siteOrigin,
          },
          inLanguage: locale,
        }),
      },
    ],
  };
};
