import {
  baseLocale,
  LOCALES,
  market_hero_desc,
  type Locale,
} from '@founders-coffee/i18n';

import {
  buildPageMetadata,
  canonicalUrl,
  localeAlternates,
  type AlternateLink,
  type CanonicalRoute,
} from './seo';
import {
  collectionPageJsonLd,
  type StructuredListItem,
} from './seo-structured-data';

type MarketRoute = Extract<CanonicalRoute, { readonly type: 'market' }>;

export type MarketReference = { readonly code: string; readonly slug: string };

/**
 * The hreflang set every market's landing page shares, so that each country is shown its own market.
 *
 * Each landing page used to name only its own three languages, as bare `ar`, `fr` and `en`. To a
 * search engine that was three unrelated Arabic home pages with nothing to say which country each
 * one serves, on a domain that names no country of its own. Every landing page now carries the same
 * set: each language of each market named with its country (`ar-EG`); each bare language at the
 * default market's page, for a reader in a country no market serves; and `x-default` at the default
 * market in the base language, which is where `/` sends a reader who has no preference.
 */
export const marketAlternates = (
  markets: readonly MarketReference[],
  defaultMarket: string,
): AlternateLink[] => [
  ...markets.flatMap((market) =>
    LOCALES.map((locale) => ({
      rel: 'alternate' as const,
      hrefLang: `${locale}-${market.code}`,
      href: canonicalUrl({ type: 'market', market: market.slug, locale }),
    })),
  ),
  ...LOCALES.map((locale) => ({
    rel: 'alternate' as const,
    hrefLang: locale,
    href: canonicalUrl({ type: 'market', market: defaultMarket, locale }),
  })),
  {
    rel: 'alternate' as const,
    hrefLang: 'x-default',
    href: canonicalUrl({
      type: 'market',
      market: defaultMarket,
      locale: baseLocale,
    }),
  },
];

/**
 * The hreflang set a landing page carries: the shared one, where it can.
 *
 * A later page of a landing's meetups has no counterpart in another market, because its cursor walks
 * that market's own list, so it keeps naming only its own languages. So does the landing of a market
 * missing from the visible ones: the shared set cannot name it without every other landing naming a
 * page that none of them links to.
 */
const landingAlternates = (
  route: MarketRoute,
  markets: readonly MarketReference[],
  defaultMarket: string,
): AlternateLink[] => {
  const home =
    markets.find((market) => market.slug === defaultMarket) ?? markets[0];
  if (!home || route.query) return localeAlternates(route);
  if (!markets.some((market) => market.slug === route.market))
    return localeAlternates(route);
  return marketAlternates(markets, home.slug);
};

type MarketHeadInput = {
  readonly locale: Locale;
  readonly marketName: string;
  readonly marketCode: string;
  readonly markets: readonly MarketReference[];
  readonly defaultMarket: string;
  readonly route: MarketRoute;
  readonly events?: readonly StructuredListItem[];
};

export const marketPageHead = ({
  locale,
  marketName,
  marketCode,
  markets,
  defaultMarket,
  route,
  events = [],
}: MarketHeadInput) => {
  const description = market_hero_desc({ market: marketName }, { locale });
  const metadata = buildPageMetadata({
    locale,
    title: marketName,
    description,
    route,
    alternates: landingAlternates(route, markets, defaultMarket),
    marketCode,
  });
  return {
    ...metadata,
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(
          collectionPageJsonLd({
            name: marketName,
            description,
            url: canonicalUrl(route),
            locale,
            items: events,
          }),
        ),
      },
    ],
  };
};
