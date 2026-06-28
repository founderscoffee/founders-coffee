import { AppError, err, ok, type Result } from '@founders-coffee/core';
import {
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
