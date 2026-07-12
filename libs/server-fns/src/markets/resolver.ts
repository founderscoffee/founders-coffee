import { AppError, err, ok, type Result } from '@founders-coffee/core';
import {
  countUpcomingByCity,
  countUpcomingByState,
  getMarketByCode,
  getMarketBySlug,
  listMarkets,
  type Db,
  type Market,
} from '@founders-coffee/db';
import { geo, markets } from '@founders-coffee/domain';

import { listEvents, type EventFeedItem } from '../events/resolver.js';

export interface MarketWithCities {
  readonly market: Market;
  readonly cities: readonly geo.GeoCity[];
  /** First page of upcoming events across the market (the Discover feed). */
  readonly events: readonly EventFeedItem[];
  /** Upcoming event counts per city code (drives the city-badge counts + aura). */
  readonly cityEventCounts: Record<string, number>;
  /** Top 3 states by upcoming events, each with its 12–20 most-active cities (the Trending section). */
  readonly trendingStates: readonly TrendingState[];
}

export interface TrendingCity {
  readonly city: geo.GeoCity;
  readonly count: number;
}

export interface TrendingState {
  readonly state: geo.GeoState;
  readonly cities: readonly TrendingCity[];
}

export interface MarketCity {
  readonly market: Market;
  readonly city: geo.GeoCity;
  /** First page of upcoming events in this city (FR-E5). */
  readonly events: readonly EventFeedItem[];
}

/**
 * Find a visible market by slug-or-code (slug first, then uppercase code). Dark markets and unknown
 * keys both return `undefined` (no existence leak). Shared by the landing resolvers so the URL can be
 * either canonical slug (`/algeria`) or the code alias (`/dz`).
 */
const findMarketByKey = async (db: Db, key: string): Promise<Market | undefined> => {
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
      new AppError('market_not_found', `No visible market for ${input.code ?? input.slug ?? '(none)'}`),
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
export const resolveMarketLanding = async (db: Db, key: string): Promise<Result<MarketWithCities>> => {
  const market = await findMarketByKey(db, key);
  if (!market) {
    return err(new AppError('market_not_found', `No visible market for ${key}`));
  }
  const [{ items: events }, cityEventCounts, trendingStates] = await Promise.all([
    listEvents(db, { marketCode: market.code, limit: 20 }),
    countUpcomingByCity(db, market.code),
    resolveTrendingStates(db, market.code),
  ]);
  return ok({
    market,
    cities: geo.getFeaturedCities(market.code),
    events,
    cityEventCounts,
    trendingStates,
  });
};

/**
 * Top 3 trending states (wilayas/governorates/regions) for the Trending section. States are ranked
 * by upcoming event count; ties break by the state capital's event count (the `featured` city —
 * "capitals first"), then by state code. Each state returns its 12–20 most-active cities: ranked by
 * event count then name, sized via `clamp(eventCityCount, 12, 20)` — so a state with no events shows
 * exactly 12 (the min), one with 25 event cities shows 20 (the max).
 */
export const resolveTrendingStates = async (
  db: Db,
  marketCode: string,
): Promise<readonly TrendingState[]> => {
  const [stateCounts, cityCounts] = await Promise.all([
    countUpcomingByState(db, marketCode),
    countUpcomingByCity(db, marketCode),
  ]);
  const states = geo.getStates(marketCode);
  const capitalByState = new Map(geo.getFeaturedCities(marketCode).map((c) => [c.stateCode, c]));

  const topStates = states
    .map((state) => {
      const capital = capitalByState.get(state.code);
      return {
        state,
        count: stateCounts[state.code] ?? 0,
        capitalCount: capital ? (cityCounts[capital.code] ?? 0) : 0,
      };
    })
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.capitalCount - a.capitalCount ||
        a.state.code.localeCompare(b.state.code),
    )
    .slice(0, 3);

  return topStates.map(({ state }) => {
    const ranked = geo
      .getCities(marketCode, state.code)
      .map((city) => ({ city, count: cityCounts[city.code] ?? 0 }))
      .sort((a, b) => b.count - a.count || a.city.name.localeCompare(b.city.name));
    const eventCityCount = ranked.filter((r) => r.count > 0).length;
    const showN = Math.max(12, Math.min(20, eventCityCount));
    return { state, cities: ranked.slice(0, showN) };
  });
};

/**
 * Resolve a visible market + one city (by slug) — the city is validated against the domain geo TS
 * data (NOT D1). Unknown market → `market_not_found`; city slug not found → `city_not_found`.
 */
export const resolveCityLanding = async (
  db: Db,
  { marketKey, citySlug }: { marketKey: string; citySlug: string },
): Promise<Result<MarketCity>> => {
  const market = await findMarketByKey(db, marketKey);
  if (!market) {
    return err(new AppError('market_not_found', `No visible market for ${marketKey}`));
  }
  const city = geo.findCityBySlug(market.code, citySlug);
  if (!city) {
    return err(new AppError('city_not_found', `No city ${citySlug} in ${market.code}`));
  }
  const { items: events } = await listEvents(db, { marketCode: market.code, cityCode: city.code, limit: 20 });
  return ok({ market, city, events });
};
