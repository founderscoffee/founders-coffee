import type { Db } from './db.js';
import { batch } from './atomic.js';
import { markets } from './schema.js';
import type { NewMarket } from './schema.js';

/**
 * Initial market seed — the launch configuration (SRS §10.2, FR-G5).
 *
 * Three target countries (P1-004 restructure — Morocco dropped):
 *   - DZ → `active`  (Algeria-first — the launch market)
 *   - EG → `active`  (Egypt)
 *   - SA → `active`  (Saudi Arabia)
 *
 * Cities are NOT seeded here — they live as server-side TS files in
 * `libs/domain/src/geo/data/` (full datasets: DZ 1,541 communes, EG 396 cities,
 * SA 4,581 cities). The `cities` D1 table is dropped (migration 0002).
 *
 * `seed()` only ever INSERTs-if-absent, so re-running never overwrites admin edits.
 */
export const SEED_MARKETS: readonly NewMarket[] = [
  {
    code: 'DZ',
    name: 'Algeria',
    slug: 'algeria',
    defaultLocale: 'ar',
    defaultCurrency: 'DZD',
    timezone: 'Africa/Algiers',
    direction: 'rtl',
    state: 'active',
    featureFlags: {
      events: true,
      hackathons: false,
      payments: false,
      recruiting: false,
    },
  },
  {
    code: 'EG',
    name: 'Egypt',
    slug: 'egypt',
    defaultLocale: 'ar',
    defaultCurrency: 'EGP',
    timezone: 'Africa/Cairo',
    direction: 'rtl',
    state: 'active',
    featureFlags: {
      events: true,
      hackathons: false,
      payments: false,
      recruiting: false,
    },
  },
  {
    code: 'SA',
    name: 'Saudi Arabia',
    slug: 'saudi-arabia',
    defaultLocale: 'ar',
    defaultCurrency: 'SAR',
    timezone: 'Asia/Riyadh',
    direction: 'rtl',
    state: 'active',
    featureFlags: {
      events: true,
      hackathons: false,
      payments: false,
      recruiting: false,
    },
  },
];

/**
 * Idempotently seed launch markets into D1. `ON CONFLICT DO NOTHING` — safe to re-run.
 * Runs in one atomic `db.batch()` round-trip (AGENTS.md §11).
 */
export const seed = async (db: Db): Promise<void> => {
  await batch(db, [
    ...SEED_MARKETS.map((market) =>
      db.insert(markets).values(market).onConflictDoNothing(),
    ),
  ]);
};
