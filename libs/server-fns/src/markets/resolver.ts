import { AppError, err, ok, type Result } from '@founders-coffee/core';
import {
  countUpcomingByCity,
  getMarketByCode,
  getMarketBySlug,
  listMarkets,
  type Db,
  type Market,
} from '@founders-coffee/db';
import { geo, markets } from '@founders-coffee/domain';

import {
  listEvents,
  type EventFeedCursor,
  type EventFeedItem,
} from '../events/resolver.js';
import { attachAttendance } from '../events/attendance.js';
import { resolveTrendingStates, type TrendingSection } from './trending.js';

export { resolveTrendingStates } from './trending.js';
export type {
  TrendingCity,
  TrendingSection,
  TrendingState,
} from './trending.js';

export interface MarketWithCities {
  readonly market: Market;
  readonly cities: readonly geo.GeoCity[];
  readonly events: readonly EventFeedItem[];
  readonly eventsNextCursor: EventFeedCursor | null;
  readonly cityEventCounts: Record<string, number>;
  readonly trending: TrendingSection;
}

export interface MarketCity {
  readonly market: Market;
  readonly city: geo.GeoCity;
  readonly events: readonly EventFeedItem[];
  readonly eventsNextCursor: EventFeedCursor | null;
}

/**
 * Find a visible market by slug-or-code (slug first, then uppercase code). Dark markets and unknown
 * keys both return `undefined` (no existence leak). Shared by the landing resolvers so the URL can be
 * either canonical slug (`/algeria`) or the code alias (`/dz`).
 */
const findMarketByKey = async (
  db: Db,
  key: string,
): Promise<Market | undefined> => {
  const bySlug = await getMarketBySlug(db, key);
  if (bySlug && markets.isMarketVisible(bySlug.state)) return bySlug;
  const byCode = await getMarketByCode(db, key.toUpperCase());
  if (byCode && markets.isMarketVisible(byCode.state)) return byCode;
  return undefined;
};

/**
 * Resolve a market for public display by code or slug. **Dark markets are hidden** — returns
 * `market_not_found` with no existence leak (FR-G3); only `open`/`active` resolve.
 */
export const resolveMarket = async (
  db: Db,
  input: { code?: string; slug?: string },
): Promise<Result<Market>> => {
  const market = input.code
    ? await getMarketByCode(db, input.code)
    : input.slug
      ? await getMarketBySlug(db, input.slug)
      : undefined;
  if (!market || !markets.isMarketVisible(market.state)) {
    return err(
      new AppError(
        'market_not_found',
        `No visible market for ${input.code ?? input.slug ?? '(none)'}`,
      ),
    );
  }
  return ok(market);
};

/** List publicly-visible markets (open + active). */
export const listVisibleMarkets = (db: Db): Promise<Market[]> =>
  listMarkets(db, { states: markets.VISIBLE_STATES });

/**
 * Resolve a visible market + its featured cities (state capitals) by slug-or-code. Cities come from
 * the domain geo TS data (server-side, NOT D1 — the `cities` table is dropped). Dark/unknown →
 * `market_not_found` (no leak). The country-landing loader calls this + canonicalizes the URL.
 */
export const resolveMarketLanding = async (
  db: Db,
  key: string,
  pagination: {
    readonly afterStartsAt?: number;
    readonly afterId?: string;
  } = {},
): Promise<Result<MarketWithCities>> => {
  const market = await findMarketByKey(db, key);
  if (!market) {
    return err(
      new AppError('market_not_found', `No visible market for ${key}`),
    );
  }
  const [
    { items: events, nextCursor: eventsNextCursor },
    cityEventCounts,
    trending,
  ] = await Promise.all([
    listEvents(db, {
      marketCode: market.code,
      afterStartsAt: pagination.afterStartsAt,
      afterId: pagination.afterId,
      limit: 20,
    }),
    countUpcomingByCity(db, market.code),
    resolveTrendingStates(db, market.code),
  ]);
  const eventsWithAttendance = await attachAttendance(db, events);
  return ok({
    market,
    cities: geo.getFeaturedCities(market.code),
    events: eventsWithAttendance,
    eventsNextCursor,
    cityEventCounts,
    trending,
  });
};

/**
 * Resolve a visible market + one city (by slug) — the city is validated against the domain geo TS
 * data (NOT D1). Unknown market → `market_not_found`; city slug not found → `city_not_found`.
 */
export const resolveCityLanding = async (
  db: Db,
  { marketKey, citySlug }: { marketKey: string; citySlug: string },
  pagination: {
    readonly afterStartsAt?: number;
    readonly afterId?: string;
  } = {},
): Promise<Result<MarketCity>> => {
  const market = await findMarketByKey(db, marketKey);
  if (!market) {
    return err(
      new AppError('market_not_found', `No visible market for ${marketKey}`),
    );
  }
  const city = geo.findCityBySlug(market.code, citySlug);
  if (!city) {
    return err(
      new AppError('city_not_found', `No city ${citySlug} in ${market.code}`),
    );
  }
  const { items: events, nextCursor: eventsNextCursor } = await listEvents(db, {
    marketCode: market.code,
    cityCode: city.code,
    afterStartsAt: pagination.afterStartsAt,
    afterId: pagination.afterId,
    limit: 20,
  });
  const eventsWithAttendance = await attachAttendance(db, events);
  return ok({
    market,
    city,
    events: eventsWithAttendance,
    eventsNextCursor,
  });
};
