import {
  city_empty_title,
  LOCALES,
  market_hero_desc,
  type Locale,
} from '@founders-coffee/i18n';
import { getRequestContext } from '@founders-coffee/observability/context';

import { CONTACT_EMAIL } from '../content/company';

import { PRODUCTION_ORIGIN } from './indexation';

export const SITE_ORIGIN = PRODUCTION_ORIGIN;

export type CanonicalRoute =
  | { readonly type: 'root'; readonly locale?: Locale }
  | {
      readonly type: 'market';
      readonly market: string;
      readonly locale?: Locale;
    }
  | {
      readonly type: 'city';
      readonly market: string;
      readonly city: string;
      readonly locale?: Locale;
    }
  | {
      readonly type: 'event';
      readonly market: string;
      readonly slug: string;
      readonly locale?: Locale;
    }
  | {
      readonly type: 'company';
      readonly path: string;
      readonly locale?: Locale;
    };

const canonicalSegments = (route: CanonicalRoute): string[] => {
  const locale = route.locale ? [route.locale] : [];
  if (route.type === 'root') return locale;
  if (route.type === 'market') return [...locale, route.market];
  if (route.type === 'city') return [...locale, route.market, route.city];
  if (route.type === 'event') return [...locale, route.market, 'e', route.slug];
  return [...locale, ...route.path.split(/[?#]/u, 1)[0].split('/')];
};

export const canonicalPath = (route: CanonicalRoute): string => {
  const segments = canonicalSegments(route)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map(encodeURIComponent);
  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
};

export const canonicalUrl = (route: CanonicalRoute): string =>
  `${getSiteOrigin()}${canonicalPath(route)}`;

export const localeAlternates = (
  route: CanonicalRoute,
): Array<{
  readonly rel: 'alternate';
  readonly hrefLang: string;
  readonly href: string;
}> => {
  const baseRoute = { ...route, locale: undefined } as CanonicalRoute;
  return [
    ...LOCALES.map((locale) => ({
      rel: 'alternate' as const,
      hrefLang: locale,
      href: canonicalUrl({ ...baseRoute, locale }),
    })),
    {
      rel: 'alternate' as const,
      hrefLang: 'x-default',
      href: canonicalUrl(baseRoute),
    },
  ];
};

export const getSiteOrigin = (): string => {
  const requestOrigin = getRequestContext().siteOrigin;
  if (requestOrigin) return requestOrigin;
  if (typeof window !== 'undefined') return window.location.origin;
  return SITE_ORIGIN;
};

export const getRequestPath = (): string => {
  const requestPath = getRequestContext().requestPath;
  if (requestPath) return requestPath;
  if (typeof window !== 'undefined') return window.location.pathname;
  return '/';
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

type MarketHeadInput = {
  readonly locale: Locale;
  readonly marketName: string;
  readonly route: CanonicalRoute;
};

export const marketPageHead = ({
  locale,
  marketName,
  route,
}: MarketHeadInput) => {
  const url = canonicalUrl(route);
  return {
    meta: [
      { title: `${marketName} - founders.coffee` },
      { name: 'description', content: market_hero_desc({}, { locale }) },
      { property: 'og:url', content: url },
    ],
    links: [{ rel: 'canonical', href: url }, ...localeAlternates(route)],
  };
};

type CityHeadInput = {
  readonly locale: Locale;
  readonly cityName: string;
  readonly isEmpty: boolean;
  readonly route: CanonicalRoute;
};

export const cityPageHead = ({
  locale,
  cityName,
  isEmpty,
  route,
}: CityHeadInput) => {
  const description = city_empty_title({ city: cityName }, { locale });
  const url = canonicalUrl(route);
  return {
    meta: [
      { title: `${cityName} - founders.coffee` },
      { name: 'description', content: description },
      { property: 'og:url', content: url },
      {
        name: 'robots',
        content: isEmpty ? 'noindex,follow' : 'index,follow',
      },
    ],
    links: [{ rel: 'canonical', href: url }, ...localeAlternates(route)],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Place',
          name: `${cityName} - founders.coffee community`,
          description,
          url,
        }),
      },
    ],
  };
};

type EventHeadInput = {
  readonly title: string;
  readonly description: string;
  readonly route: CanonicalRoute;
};

export const eventPageHead = ({
  title,
  description,
  route,
}: EventHeadInput) => {
  const url = canonicalUrl(route);
  return {
    meta: [
      { title: `${title} - founders.coffee` },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'event' },
      { property: 'og:url', content: url },
    ],
    links: [{ rel: 'canonical', href: url }, ...localeAlternates(route)],
  };
};

type CompanyHeadInput = {
  locale: Locale;
  path: string;
  canonicalLocale?: Locale;
  title: string;
  description: string;
};

/** Shared meta + WebPage JSON-LD for About / Contact / Privacy / Terms / Cookies. */
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
    links: [{ rel: 'canonical', href: url }, ...localeAlternates(route)],
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
