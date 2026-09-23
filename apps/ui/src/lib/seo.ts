import {
  city_events_description,
  city_empty_body,
  cityInputs,
  LOCALES,
  market_hero_desc,
  social_image_alt,
  type Locale,
} from '@founders-coffee/i18n';
import { getRequestContext } from '@founders-coffee/observability/context';

import { PRODUCTION_ORIGIN } from './indexation';
import { xDefaultLocale } from './seo-alternates';
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  type StructuredListItem,
} from './seo-structured-data';

export const SITE_ORIGIN = PRODUCTION_ORIGIN;
export const SITE_NAME = 'Founders Coffee';
export const DEFAULT_SOCIAL_IMAGE_PATH = '/social/founders-coffee-default.png';

export type CanonicalRoute =
  | { readonly type: 'root'; readonly locale?: Locale; readonly query?: string }
  | {
      readonly type: 'market';
      readonly market: string;
      readonly locale?: Locale;
      readonly query?: string;
    }
  | {
      readonly type: 'city';
      readonly market: string;
      readonly city: string;
      readonly locale?: Locale;
      readonly query?: string;
    }
  | {
      readonly type: 'event';
      readonly market: string;
      readonly slug: string;
      readonly locale?: Locale;
      readonly query?: string;
    }
  | {
      readonly type: 'company';
      readonly path: string;
      readonly locale?: Locale;
      readonly query?: string;
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
  `${getSiteOrigin()}${canonicalPath(route)}${route.query ? `?${route.query}` : ''}`;

export const localeAlternates = (
  route: CanonicalRoute,
  locales: readonly Locale[] = LOCALES,
): Array<{
  readonly rel: 'alternate';
  readonly hrefLang: string;
  readonly href: string;
}> => {
  const baseRoute = { ...route, locale: undefined } as CanonicalRoute;
  return [
    ...locales.map((locale) => ({
      rel: 'alternate' as const,
      hrefLang: locale,
      href: canonicalUrl({ ...baseRoute, locale }),
    })),
    {
      rel: 'alternate' as const,
      hrefLang: 'x-default',
      href: canonicalUrl({ ...baseRoute, locale: xDefaultLocale(locales) }),
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

const MAX_TITLE_LENGTH = 70;
const MAX_DESCRIPTION_LENGTH = 160;

const normalizeText = (value: string, maxLength: number): string => {
  const normalized = value.replace(/\s+/gu, ' ').trim();
  const codePoints = Array.from(normalized);
  if (codePoints.length <= maxLength) return normalized;
  return `${codePoints.slice(0, maxLength - 1).join('')}…`;
};

export const buildPageTitle = (title: string): string => {
  const pageTitle = normalizeText(title, MAX_TITLE_LENGTH)
    .replace(/founders(?:\.coffee| coffee)/giu, '')
    .replace(/\s+/gu, ' ')
    .replace(/^\s*[-–—·:]\s*/u, '')
    .replace(/\s*[-–—·:]\s*$/u, '')
    .trim();
  return normalizeText(
    pageTitle ? `${SITE_NAME} - ${pageTitle}` : SITE_NAME,
    MAX_TITLE_LENGTH,
  );
};

const localeOpenGraph = (locale: Locale): string =>
  locale === 'ar' ? 'ar_DZ' : locale === 'fr' ? 'fr_FR' : 'en_US';

export type PageMetadataInput = {
  readonly locale: Locale;
  readonly title: string;
  readonly description: string;
  readonly route: CanonicalRoute;
  readonly robots?: string;
  readonly openGraphType?: 'website' | 'event';
  readonly alternateLocales?: readonly Locale[];
  readonly socialImage?: { readonly url: string; readonly alt: string };
};

export const buildPageMetadata = ({
  locale,
  title,
  description,
  route,
  robots = 'index,follow',
  openGraphType = 'website',
  alternateLocales = LOCALES,
  socialImage: card,
}: PageMetadataInput) => {
  const fullTitle = buildPageTitle(title);
  const normalizedDescription = normalizeText(
    description,
    MAX_DESCRIPTION_LENGTH,
  );
  const url = canonicalUrl(route);
  const socialImage =
    card?.url ?? `${getSiteOrigin()}${DEFAULT_SOCIAL_IMAGE_PATH}`;
  const socialImageAlt = card?.alt ?? social_image_alt({}, { locale });
  return {
    meta: [
      { title: fullTitle },
      { name: 'description', content: normalizedDescription },
      { name: 'robots', content: robots },
      { property: 'og:type', content: openGraphType },
      { property: 'og:site_name', content: 'Founders Coffee' },
      { property: 'og:title', content: fullTitle },
      { property: 'og:description', content: normalizedDescription },
      { property: 'og:url', content: url },
      { property: 'og:locale', content: localeOpenGraph(locale) },
      { property: 'og:image', content: socialImage },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: socialImageAlt },
      ...alternateLocales
        .filter((alternate) => alternate !== locale)
        .map((alternate) => ({
          property: 'og:locale:alternate',
          content: localeOpenGraph(alternate),
        })),
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: fullTitle },
      { name: 'twitter:description', content: normalizedDescription },
      { name: 'twitter:image', content: socialImage },
      { name: 'twitter:image:alt', content: socialImageAlt },
    ],
    links: [
      { rel: 'canonical', href: url },
      ...localeAlternates(route, alternateLocales),
    ],
  };
};

type MarketHeadInput = {
  readonly locale: Locale;
  readonly marketName: string;
  readonly route: Extract<CanonicalRoute, { readonly type: 'market' }>;
  readonly events?: readonly StructuredListItem[];
};

export const marketPageHead = ({
  locale,
  marketName,
  route,
  events = [],
}: MarketHeadInput) => {
  const metadata = buildPageMetadata({
    locale,
    title: marketName,
    description: market_hero_desc({ market: marketName }, { locale }),
    route,
  });
  return {
    ...metadata,
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(
          collectionPageJsonLd({
            name: marketName,
            description: market_hero_desc({ market: marketName }, { locale }),
            url: canonicalUrl(route),
            locale,
            items: events,
          }),
        ),
      },
    ],
  };
};

type CityHeadInput = {
  readonly locale: Locale;
  readonly marketName: string;
  readonly cityName: string;
  readonly isEmpty: boolean;
  readonly route: Extract<CanonicalRoute, { readonly type: 'city' }>;
  readonly events?: readonly StructuredListItem[];
};

export const cityPageHead = ({
  locale,
  marketName,
  cityName,
  isEmpty,
  route,
  events = [],
}: CityHeadInput) => {
  const description = isEmpty
    ? city_empty_body(cityInputs(cityName), { locale })
    : city_events_description(cityInputs(cityName), { locale });
  const metadata = buildPageMetadata({
    locale,
    title: `${cityName} · ${marketName}`,
    description,
    route,
    robots: isEmpty ? 'noindex,follow' : 'index,follow',
  });
  const breadcrumbs: StructuredListItem[] = [
    { name: 'Founders Coffee', url: canonicalUrl({ type: 'root', locale }) },
    {
      name: marketName,
      url: canonicalUrl({
        type: 'market',
        market: route.market,
        locale,
      }),
    },
    { name: cityName, url: canonicalUrl(route) },
  ];
  return {
    ...metadata,
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(
          collectionPageJsonLd({
            name: `${cityName} · ${marketName}`,
            description,
            url: canonicalUrl(route),
            locale,
            items: events,
          }),
        ),
      },
      {
        type: 'application/ld+json',
        children: JSON.stringify(breadcrumbJsonLd(breadcrumbs)),
      },
    ],
  };
};
