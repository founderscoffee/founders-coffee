import { createServerFn } from '@tanstack/react-start';

import { geo, markets } from '@founders-coffee/domain';
import {
  listCitiesWithUpcomingEvents,
  listPublicEventSitemapRows,
  listMarkets,
  type Market,
} from '@founders-coffee/db';

import { getDb } from './db.js';

export type SitemapMarket = Pick<Market, 'slug'>;

export type SitemapCity = {
  readonly market: string;
  readonly city: string;
};

export type SitemapEvent = {
  readonly market: string;
  readonly slug: string;
  readonly updatedAt: Date;
};

export type SitemapData = {
  readonly markets: readonly SitemapMarket[];
  readonly cities: readonly SitemapCity[];
  readonly events: readonly SitemapEvent[];
};

/**
 * The city pages worth advertising: the ones that will not answer `noindex` when Google arrives.
 *
 * This used to walk the geo catalogue and list every city of every visible market. That is 6,520
 * cities, and the sitemap emits three locales apiece, so it asked Google to crawl 17,484 city URLs
 * while `cityPageHead` answered `noindex,follow` on all but the few with an upcoming gathering — a
 * sitemap that was 99.8% pages the site refuses to have indexed (#82). Crawl budget spent there is
 * crawl budget not spent on the events.
 *
 * Keyed off the same predicate the page decides with, so the two cannot drift apart again; the
 * integration suite holds them together by fetching an eventless city and checking it is both
 * noindex and absent from here.
 */
const citiesWithSomethingToShow = (
  rows: readonly { marketCode: string; cityCode: string }[],
  marketByCode: ReadonlyMap<string, Market>,
): SitemapCity[] =>
  rows.flatMap((row) => {
    const market = marketByCode.get(row.marketCode);
    const city = market && geo.findCity(market.code, row.cityCode);
    return market && city ? [{ market: market.slug, city: city.slug }] : [];
  });

export const getSitemapData = createServerFn({ strict: false }).handler(
  async (): Promise<SitemapData> => {
    const db = getDb();
    const visibleMarkets = await listMarkets(db, {
      states: markets.VISIBLE_STATES,
    });
    const marketByCode = new Map(
      visibleMarkets.map((market) => [market.code, market]),
    );
    const [eventRows, cityRows] = await Promise.all([
      listPublicEventSitemapRows(db),
      listCitiesWithUpcomingEvents(db),
    ]);
    const events = eventRows.flatMap((row) => {
      const market = marketByCode.get(row.marketCode);
      const city = market && geo.findCity(market.code, row.cityCode);
      return market && city
        ? [
            {
              market: market.slug,
              slug: row.slug,
              updatedAt: row.updatedAt,
            },
          ]
        : [];
    });
    return {
      markets: visibleMarkets.map(({ slug }) => ({ slug })),
      cities: citiesWithSomethingToShow(cityRows, marketByCode),
      events,
    };
  },
);
