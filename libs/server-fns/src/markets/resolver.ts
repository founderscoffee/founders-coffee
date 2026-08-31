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
  /**
   * Browse section under the hero. Cold markets use `variant: 'major'` (featured cities only).
   * Markets with upcoming events use `variant: 'active'` (states/cities that actually have meetups).
   */
  readonly trending: TrendingSection;
}

export interface TrendingCity {
  readonly city: geo.GeoCity;
  readonly count: number;
}

export interface TrendingState {
  /** When null, the UI renders a flat city list (cold “major cities” mode). */
  readonly state: geo.GeoState | null;
  readonly cities: readonly TrendingCity[];
}

/** Landing browse section: curated majors when empty, activity-ranked when warm. */
export interface TrendingSection {
  readonly variant: 'major' | 'active';
  readonly groups: readonly TrendingState[];
}

/** Max featured cities shown on a cold (zero-event) market landing. */
const COLD_MAJOR_CITY_CAP = 18;
/** Max states in the warm “active cities” section. */
const WARM_STATE_CAP = 3;
/** Max cities per warm state (only cities with upcoming events). */
const WARM_CITY_CAP = 8;

/**
 * Preferred browse order for cold landings. Unknown featured cities follow alphabetically.
 * Shared policy for every market — only the slug list is country-specific.
 */
const COLD_PRIORITY_SLUGS: Readonly<Record<string, readonly string[]>> = {
  DZ: [
    'algiers',
    'oran',
    'constantine',
    'bejaia',
    'setif',
    'annaba',
    'blida',
    'batna',
    'tlemcen',
    'tizi-ouzou',
    'djelfa',
    'sidi-bel-abbes',
    'biskra',
    'tebessa',
    'skikda',
    'tiaret',
    'bechar',
    'mostaganem',
  ],
  EG: [
    'cairo',
    'alexandria',
    'giza',
    'mansoura',
    'tanta',
    'hurghada',
    'sharm-el-shaikh',
    'aswan',
    'luxor',
    'ismailia',
    'suez',
    'zagazig',
    'damanhour',
    'minya',
  ],
  SA: [
    'riyadh',
    'makkah',
    'dammam',
    'madinah',
    'tabuk',
    'abha',
    'buraidah',
    'jazan',
    'hail',
    'najran',
    'bahah',
    'arar',
    'sakaka',
  ],
};

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
): Promise<Result<MarketWithCities>> => {
  const market = await findMarketByKey(db, key);
  if (!market) {
    return err(
      new AppError('market_not_found', `No visible market for ${key}`),
    );
  }
  const [{ items: events }, cityEventCounts, trending] = await Promise.all([
    listEvents(db, { marketCode: market.code, limit: 20 }),
    countUpcomingByCity(db, market.code),
    resolveTrendingStates(db, market.code),
  ]);
  return ok({
    market,
    cities: geo.getFeaturedCities(market.code),
    events,
    cityEventCounts,
    trending,
  });
};

const coldMajorCities = (marketCode: string): TrendingSection => {
  const priority = new Map(
    (COLD_PRIORITY_SLUGS[marketCode] ?? []).map((slug, i) => [slug, i]),
  );
  const cities = [...geo.getFeaturedCities(marketCode)]
    .map((city) => ({ city, count: 0 }))
    .sort(
      (a, b) =>
        (priority.get(a.city.slug) ?? 1_000) -
          (priority.get(b.city.slug) ?? 1_000) ||
        a.city.name.localeCompare(b.city.name),
    )
    .slice(0, COLD_MAJOR_CITY_CAP);
  if (cities.length === 0) return { variant: 'major', groups: [] };
  return { variant: 'major', groups: [{ state: null, cities }] };
};

const warmActiveCities = (
  marketCode: string,
  stateCounts: Record<string, number>,
  cityCounts: Record<string, number>,
): TrendingSection => {
  const topStates = geo
    .getStates(marketCode)
    .map((state) => ({ state, count: stateCounts[state.code] ?? 0 }))
    .filter((s) => s.count > 0)
    .sort(
      (a, b) => b.count - a.count || a.state.code.localeCompare(b.state.code),
    )
    .slice(0, WARM_STATE_CAP);

  const groups = topStates.map(({ state }) => {
    const cities = geo
      .getCities(marketCode, state.code)
      .map((city) => ({ city, count: cityCounts[city.code] ?? 0 }))
      .filter((c) => c.count > 0)
      .sort(
        (a, b) => b.count - a.count || a.city.name.localeCompare(b.city.name),
      )
      .slice(0, WARM_CITY_CAP);
    return { state, cities };
  });

  return {
    variant: 'active',
    groups: groups.filter((g) => g.cities.length > 0),
  };
};

/**
 * Browse section for a market landing.
 *
 * - **Cold** (no upcoming events): flat list of featured/major cities — never pads empty communes.
 * - **Warm**: top states by upcoming events; only cities with `count > 0` (no zero-badge padding).
 */
export const resolveTrendingStates = async (
  db: Db,
  marketCode: string,
): Promise<TrendingSection> => {
  const [stateCounts, cityCounts] = await Promise.all([
    countUpcomingByState(db, marketCode),
    countUpcomingByCity(db, marketCode),
  ]);
  const totalUpcoming = Object.values(cityCounts).reduce(
    (sum, n) => sum + n,
    0,
  );
  if (totalUpcoming === 0) return coldMajorCities(marketCode);
  return warmActiveCities(marketCode, stateCounts, cityCounts);
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
  const { items: events } = await listEvents(db, {
    marketCode: market.code,
    cityCode: city.code,
    limit: 20,
  });
  return ok({ market, city, events });
};
