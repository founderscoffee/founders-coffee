import {
  city_events_description,
  city_empty_body,
  event_meta_description,
  LOCALES,
  market_hero_desc,
  market_hero_title,
  type Locale,
} from '@founders-coffee/i18n';
import { getRequestContext } from '@founders-coffee/observability/context';

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

const MAX_TITLE_LENGTH = 70;
const MAX_DESCRIPTION_LENGTH = 160;

const normalizeText = (value: string, maxLength: number): string => {
  const normalized = value.replace(/\s+/gu, ' ').trim();
  const codePoints = Array.from(normalized);
  if (codePoints.length <= maxLength) return normalized;
  return `${codePoints.slice(0, maxLength - 1).join('')}…`;
};

const brandedTitle = (title: string): string => {
  const normalized = normalizeText(title, MAX_TITLE_LENGTH);
  if (normalized.toLocaleLowerCase().includes('founders.coffee')) {
    return normalized;
  }
  return normalizeText(`${normalized} - founders.coffee`, MAX_TITLE_LENGTH);
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
};

export const buildPageMetadata = ({
  locale,
  title,
  description,
  route,
  robots = 'index,follow',
  openGraphType = 'website',
}: PageMetadataInput) => {
  const fullTitle = brandedTitle(title);
  const normalizedDescription = normalizeText(
    description,
    MAX_DESCRIPTION_LENGTH,
  );
  const url = canonicalUrl(route);
  return {
    meta: [
      { title: fullTitle },
      { name: 'description', content: normalizedDescription },
      { name: 'robots', content: robots },
      { property: 'og:type', content: openGraphType },
      { property: 'og:site_name', content: 'founders.coffee' },
      { property: 'og:title', content: fullTitle },
      { property: 'og:description', content: normalizedDescription },
      { property: 'og:url', content: url },
      { property: 'og:locale', content: localeOpenGraph(locale) },
      ...LOCALES.filter((alternate) => alternate !== locale).map(
        (alternate) => ({
          property: 'og:locale:alternate',
          content: localeOpenGraph(alternate),
        }),
      ),
      { name: 'twitter:card', content: 'summary' },
      { name: 'twitter:title', content: fullTitle },
      { name: 'twitter:description', content: normalizedDescription },
    ],
    links: [{ rel: 'canonical', href: url }, ...localeAlternates(route)],
  };
};

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
  return buildPageMetadata({
    locale,
    title: market_hero_title({ market: marketName }, { locale }),
    description: market_hero_desc({}, { locale }),
    route,
  });
};

type CityHeadInput = {
  readonly locale: Locale;
  readonly marketName: string;
  readonly cityName: string;
  readonly isEmpty: boolean;
  readonly route: CanonicalRoute;
};

export const cityPageHead = ({
  locale,
  marketName,
  cityName,
  isEmpty,
  route,
}: CityHeadInput) => {
  const description = isEmpty
    ? city_empty_body({ city: cityName }, { locale })
    : city_events_description({ city: cityName }, { locale });
  const metadata = buildPageMetadata({
    locale,
    title: `${cityName} · ${marketName}`,
    description,
    route,
    robots: isEmpty ? 'noindex,follow' : 'index,follow',
  });
  return {
    ...metadata,
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Place',
          name: `${cityName} - founders.coffee community`,
          description,
          url: canonicalUrl(route),
        }),
      },
    ],
  };
};

type EventHeadInput = {
  readonly locale: Locale;
  readonly title: string;
  readonly cityName: string;
  readonly description?: string;
  readonly route: CanonicalRoute;
};

export const eventPageHead = ({
  locale,
  title,
  cityName,
  description,
  route,
}: EventHeadInput) => {
  return buildPageMetadata({
    locale,
    title: `${title} · ${cityName}`,
    description:
      description ||
      event_meta_description({ title, city: cityName }, { locale }),
    route,
    openGraphType: 'event',
  });
};
