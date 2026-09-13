import { LOCALES, type Locale } from '@founders-coffee/i18n';
import type {
  SitemapCity,
  SitemapData,
  SitemapEvent,
  SitemapMarket,
} from '@founders-coffee/server-fns';

import { canonicalPath, type CanonicalRoute } from './seo';
import { sitemapCompanyItems } from './sitemap-contract';

export type SitemapItem = {
  readonly path: string;
  readonly lastmod?: string;
};

const localizedPath = (route: CanonicalRoute, locale: Locale): string =>
  canonicalPath({ ...route, locale });

const marketItems = (markets: readonly SitemapMarket[]): SitemapItem[] =>
  markets.flatMap((market) =>
    LOCALES.map((locale) => ({
      path: localizedPath({ type: 'market', market: market.slug }, locale),
    })),
  );

const cityItems = (cities: readonly SitemapCity[]): SitemapItem[] =>
  cities.flatMap((city) =>
    LOCALES.map((locale) => ({
      path: localizedPath(
        { type: 'city', market: city.market, city: city.city },
        locale,
      ),
    })),
  );

const eventItems = (events: readonly SitemapEvent[]): SitemapItem[] =>
  events.flatMap((event) =>
    LOCALES.map((locale) => ({
      path: localizedPath(
        { type: 'event', market: event.market, slug: event.slug },
        locale,
      ),
      lastmod: event.updatedAt.toISOString(),
    })),
  );

const companyItems = (): SitemapItem[] => sitemapCompanyItems();

export const sitemapItems = (data: SitemapData): SitemapItem[] => {
  const items = [
    ...marketItems(data.markets),
    ...cityItems(data.cities),
    ...eventItems(data.events),
    ...companyItems(),
  ];
  const seen = new Set<string>();
  return items
    .filter((item) => {
      if (seen.has(item.path)) return false;
      seen.add(item.path);
      return true;
    })
    .sort((a, b) => a.path.localeCompare(b.path));
};

const escapeXml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

export const sitemapXml = (
  origin: string,
  items: readonly SitemapItem[],
): string => {
  const normalizedOrigin = origin.replace(/\/$/u, '');
  const urls = items
    .map(
      ({ path, lastmod }) =>
        `  <url><loc>${escapeXml(`${normalizedOrigin}${path}`)}</loc>${
          lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : ''
        }</url>`,
    )
    .join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    '</urlset>',
  ].join('\n');
};

export const emptySitemapXml = (origin: string): string =>
  sitemapXml(origin, []);
