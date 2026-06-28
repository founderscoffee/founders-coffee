import { AppError, err, ok, type Result } from '@founders-coffee/core';
import {
  getCityBySlug,
  getMarketByCode,
  getMarketBySlug,
  listCitiesByMarket,
  listMarkets,
  type City,
  type Db,
  type Market,
} from '@founders-coffee/db';
import { markets } from '@founders-coffee/domain';

export interface MarketWithCities {
  readonly market: Market;
  readonly cities: readonly City[];
}

export interface MarketCity {
  readonly market: Market;
  readonly city: City;
}

/**
 * Find a visible market by slug-or-code (slug first, then uppercase code). Dark markets and unknown
 * keys both return `undefined` (no existence leak). Shared by the landing resolvers so the URL can be
 * either canonical slug (`/morocco`) or the code alias (`/ma`).
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
 * `market_not_found` with no existence leak (FR-G3); only `open`/`active` resolve. The
 * `createServerFn` RPC wrappers (P1-017, with env-injection) call this via `getDb()`.
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

/** Resolve a visible market + its cities (FR-G6 — discover events by city). Dark → not found. */
export const getMarketWithCities = async (
  db: Db,
  code: string,
): Promise<Result<MarketWithCities>> => {
  const resolved = await resolveMarket(db, { code });
  if (!resolved.ok) return err(resolved.error);
  return ok({ market: resolved.data, cities: await listCitiesByMarket(db, code) });
};

/** List publicly-visible markets (open + active). */
export const listVisibleMarkets = (db: Db): Promise<Market[]> =>
  listMarkets(db, { states: markets.VISIBLE_STATES });

/**
 * Resolve a visible market + its cities by slug-or-code (FR-G6 discover-by-city). Dark/unknown →
 * `market_not_found` (no leak). The P1-002 country-landing loader calls this, then canonicalizes the
 * URL to the slug (redirecting `/ma` → `/morocco`).
 */
export const resolveMarketLanding = async (db: Db, key: string): Promise<Result<MarketWithCities>> => {
  const market = await findMarketByKey(db, key);
  if (!market) {
    return err(new AppError('market_not_found', `No visible market for ${key}`));
  }
  return ok({ market, cities: await listCitiesByMarket(db, market.code) });
};

/**
 * Resolve a visible market + one city (by slug, **market-scoped** — `/dz/casablanca` 404s since
 * Casablanca ∈ MA). Unknown market → `market_not_found`; city missing in that market → `city_not_found`.
 */
export const resolveCityLanding = async (
  db: Db,
  { marketKey, citySlug }: { marketKey: string; citySlug: string },
): Promise<Result<MarketCity>> => {
  const market = await findMarketByKey(db, marketKey);
  if (!market) {
    return err(new AppError('market_not_found', `No visible market for ${marketKey}`));
  }
  const city = await getCityBySlug(db, market.code, citySlug);
  if (!city) {
    return err(new AppError('city_not_found', `No city ${citySlug} in ${market.code}`));
  }
  return ok({ market, city });
};
