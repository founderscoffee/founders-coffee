import { createServerFn } from '@tanstack/react-start';

import { geo, markets } from '@founders-coffee/domain';
import {
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

const visibleCities = (visibleMarkets: readonly Market[]): SitemapCity[] =>
  visibleMarkets.flatMap((market) =>
    geo
      .getStates(market.code)
      .flatMap((state) => geo.getCities(market.code, state.code))
      .map((city) => ({ market: market.slug, city: city.slug })),
  );

export const getSitemapData = createServerFn({ strict: false }).handler(
  async (): Promise<SitemapData> => {
    const db = getDb();
    const visibleMarkets = await listMarkets(db, {
      states: markets.VISIBLE_STATES,
    });
    const marketByCode = new Map(
      visibleMarkets.map((market) => [market.code, market]),
    );
    const eventRows = await listPublicEventSitemapRows(db);
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
      cities: visibleCities(visibleMarkets),
      events,
    };
  },
);
