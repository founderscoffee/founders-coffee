import { and, eq, inArray } from 'drizzle-orm';

import type { Db } from './db.js';
import { cities, markets, type City, type Market } from './schema.js';

/** Fetch a market by its primary key (code). */
export const getMarketByCode = async (db: Db, code: string): Promise<Market | undefined> => {
  const rows = await db.select().from(markets).where(eq(markets.code, code)).limit(1);
  return rows[0];
};

/** Fetch a market by slug (path-style resolution, e.g. `/morocco`). */
export const getMarketBySlug = async (db: Db, slug: string): Promise<Market | undefined> => {
  const rows = await db.select().from(markets).where(eq(markets.slug, slug)).limit(1);
  return rows[0];
};

/** List markets, optionally filtered by state. The visibility set is passed by the caller — the
 * data layer owns no visibility rule (that's domain). */
export const listMarkets = async (
  db: Db,
  opts: { states?: readonly Market['state'][] } = {},
): Promise<Market[]> => {
  const rows =
    opts.states && opts.states.length > 0
      ? await db.select().from(markets).where(inArray(markets.state, [...opts.states]))
      : await db.select().from(markets);
  return rows;
};

/** List cities in a market (FR-G6 — discover by city). */
export const listCitiesByMarket = async (db: Db, marketCode: string): Promise<City[]> =>
  db.select().from(cities).where(eq(cities.marketCode, marketCode));

/** Fetch a city by slug within a market — slug is unique per market, not globally. */
export const getCityBySlug = async (
  db: Db,
  marketCode: string,
  slug: string,
): Promise<City | undefined> => {
  const rows = await db
    .select()
    .from(cities)
    .where(and(eq(cities.marketCode, marketCode), eq(cities.slug, slug)))
    .limit(1);
  return rows[0];
};
