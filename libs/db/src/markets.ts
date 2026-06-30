import { eq, inArray } from 'drizzle-orm';

import type { Db } from './db.js';
import { markets, type Market } from './schema.js';

/** Fetch a market by its primary key (code). */
export const getMarketByCode = async (db: Db, code: string): Promise<Market | undefined> => {
  const rows = await db.select().from(markets).where(eq(markets.code, code)).limit(1);
  return rows[0];
};

/** Fetch a market by slug (path-style resolution, e.g. `/algeria`). */
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
