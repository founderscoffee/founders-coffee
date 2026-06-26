import type { Db } from './db.js';
import { batch } from './atomic.js';
import { cities, markets } from './schema.js';
import type { NewCity, NewMarket } from './schema.js';

/**
 * Initial market/city seed — the launch configuration (SRS §10.2, FR-G5).
 *
 * Only the two launch markets are seeded:
 *   - DZ → `active`  (full operational investment — the free-events wedge goes live here)
 *   - MA → `open`    (visible, self-serve posting allowed, reads demand; no investment)
 * EG/SA/AE stay `dark` and are NOT seeded at launch (density-gated, §2.2).
 *
 * Defaults chosen here are admin-configurable post-launch (FR-M1): market state,
 * feature flags and brand overrides can all be changed from `apps/admin` without
 * a redeploy. `seed()` only ever INSERTs-if-absent, so re-running it never
 * overwrites edits an admin has made.
 *
 * Locale/direction: Arabic-first (SRS §8.6) — both DZ and MA default to `ar`
 * (Modern Standard Arabic, RTL), with `fr`/`en` selectable. Language is
 * language-level (not region-variant); region concerns (timezone, currency)
 * stay on the market.
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
    code: 'MA',
    name: 'Morocco',
    slug: 'morocco',
    defaultLocale: 'ar',
    defaultCurrency: 'MAD',
    timezone: 'Africa/Casablanca',
    direction: 'rtl',
    state: 'open',
    featureFlags: {
      events: true,
      hackathons: false,
      payments: false,
      recruiting: false,
    },
  },
];

/** Build a seeded city row with a stable, globally-unique id. */
const city = (
  marketCode: NewCity['marketCode'],
  slug: string,
  name: string,
  timezone: string,
): NewCity => ({
  id: `${marketCode.toLowerCase()}_${slug}`,
  marketCode,
  name,
  slug,
  timezone,
});

/** Major pre-seeded cities per market (FR-G5). Both countries are single-timezone. */
export const SEED_CITIES: readonly NewCity[] = [
  city('DZ', 'algiers', 'Alger', 'Africa/Algiers'),
  city('DZ', 'oran', 'Oran', 'Africa/Algiers'),
  city('DZ', 'constantine', 'Constantine', 'Africa/Algiers'),
  city('DZ', 'annaba', 'Annaba', 'Africa/Algiers'),
  city('DZ', 'blida', 'Blida', 'Africa/Algiers'),
  city('MA', 'casablanca', 'Casablanca', 'Africa/Casablanca'),
  city('MA', 'rabat', 'Rabat', 'Africa/Casablanca'),
  city('MA', 'marrakech', 'Marrakech', 'Africa/Casablanca'),
  city('MA', 'fes', 'Fès', 'Africa/Casablanca'),
  city('MA', 'tanger', 'Tanger', 'Africa/Casablanca'),
];

/**
 * Idempotently seed launch markets + cities into D1.
 *
 * Inserts use `ON CONFLICT DO NOTHING`, so this is safe to re-run any number of
 * times and will never duplicate rows or clobber admin edits. All statements run
 * in one atomic `db.batch()` round-trip (D1 has no interactive transactions —
 * AGENTS.md §11); markets precede their cities so the
 * `cities.market_code → markets.code` foreign key holds within the batch.
 */
export const seed = async (db: Db): Promise<void> => {
  await batch(db, [
    ...SEED_MARKETS.map((market) =>
      db.insert(markets).values(market).onConflictDoNothing(),
    ),
    ...SEED_CITIES.map((cityRow) =>
      db.insert(cities).values(cityRow).onConflictDoNothing(),
    ),
  ]);
};
