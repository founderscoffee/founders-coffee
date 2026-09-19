import type { Db } from './db.js';
import { batch } from './atomic.js';
import { markets } from './schema.js';
import type { NewMarket } from './schema.js';

export const SEED_MARKETS: readonly NewMarket[] = [
  {
    code: 'DZ',
    name: 'Algeria',
    nameAr: 'الجزائر',
    nameFr: 'Algérie',
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
      communityOperations: true,
    },
  },
  {
    code: 'EG',
    name: 'Egypt',
    nameAr: 'مصر',
    nameFr: 'Égypte',
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
      communityOperations: true,
    },
  },
  {
    code: 'SA',
    name: 'Saudi Arabia',
    nameAr: 'السعودية',
    nameFr: 'Arabie saoudite',
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
      communityOperations: true,
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
