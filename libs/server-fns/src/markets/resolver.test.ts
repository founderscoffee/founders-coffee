import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createDb, markets as marketsTable, seed, type Db } from '@founders-coffee/db';

import {
  listVisibleMarkets,
  resolveCityLanding,
  resolveMarket,
  resolveMarketLanding,
} from './resolver.js';

/**
 * Seed a dark market to verify it is hidden from public resolution. Uses `AE` (a target country
 * that is NOT in the active seed) so `onConflictDoNothing` does not silently no-op against a seeded
 * active row — the dark insert must actually take effect.
 */
const seedDarkMarket = async (db: Db): Promise<void> => {
  await db
    .insert(marketsTable)
    .values({
      code: 'AE',
      name: 'United Arab Emirates',
      slug: 'united-arab-emirates',
      defaultLocale: 'ar',
      defaultCurrency: 'AED',
      timezone: 'Asia/Dubai',
      direction: 'rtl',
      state: 'dark',
      featureFlags: { events: false, hackathons: false, payments: false, recruiting: false },
    })
    .onConflictDoNothing()
    .run();
};

describe('markets resolver (real D1)', () => {
  it('resolves a visible market by code or slug', async () => {
    const db = createDb(env.DB);
    await seed(db);

    const byCode = await resolveMarket(db, { code: 'DZ' });
    const bySlug = await resolveMarket(db, { slug: 'egypt' });

    expect(byCode.ok).toBe(true);
    if (byCode.ok) expect(byCode.data.code).toBe('DZ');
    expect(bySlug.ok).toBe(true);
    if (bySlug.ok) expect(bySlug.data.code).toBe('EG');
  });

  it('hides dark markets (no existence leak) and unknown codes', async () => {
    const db = createDb(env.DB);
    await seed(db);
    await seedDarkMarket(db);

    const dark = await resolveMarket(db, { code: 'AE' });
    expect(dark.ok).toBe(false);
    if (!dark.ok) expect(dark.error.code).toBe('market_not_found');

    const unknown = await resolveMarket(db, { code: 'ZZ' });
    expect(unknown.ok).toBe(false);
  });

  it('lists only visible markets (dark excluded)', async () => {
    const db = createDb(env.DB);
    await seed(db);
    await seedDarkMarket(db);

    const visible = await listVisibleMarkets(db);

    expect(visible.every((m) => m.state !== 'dark')).toBe(true);
    expect(visible.find((m) => m.code === 'AE')).toBeUndefined();
  });
});

describe('resolveMarketLanding (slug-or-code key)', () => {
  it('resolves by slug or by code alias, returning featured cities from geo data', async () => {
    const db = createDb(env.DB);
    await seed(db);

    const bySlug = await resolveMarketLanding(db, 'egypt');
    const byCode = await resolveMarketLanding(db, 'eg');

    expect(bySlug.ok).toBe(true);
    if (bySlug.ok) {
      expect(bySlug.data.market.code).toBe('EG');
      expect(Array.isArray(bySlug.data.cities)).toBe(true);
      expect(Array.isArray(bySlug.data.events)).toBe(true);
      expect(typeof bySlug.data.cityEventCounts).toBe('object');
    }
    expect(byCode.ok).toBe(true);
    if (byCode.ok) expect(byCode.data.market.code).toBe('EG');
  });

  it('hides dark markets (no existence leak)', async () => {
    const db = createDb(env.DB);
    await seed(db);
    await seedDarkMarket(db);

    const bySlug = await resolveMarketLanding(db, 'united-arab-emirates');
    const byCode = await resolveMarketLanding(db, 'ae');

    expect(bySlug.ok).toBe(false);
    expect(byCode.ok).toBe(false);
  });
});

describe('resolveCityLanding (market-scoped, validated via geo TS data)', () => {
  it('resolves a city within its market', async () => {
    const db = createDb(env.DB);
    await seed(db);

    const result = await resolveCityLanding(db, { marketKey: 'dz', citySlug: 'adrar' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.market.code).toBe('DZ');
      expect(result.data.city.slug).toBe('adrar');
      expect(Array.isArray(result.data.events)).toBe(true);
    }
  });

  it('rejects a city from a different market (no cross-market leak)', async () => {
    const db = createDb(env.DB);
    await seed(db);

    const result = await resolveCityLanding(db, { marketKey: 'dz', citySlug: 'riyadh' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('city_not_found');
  });

  it('rejects an unknown market', async () => {
    const db = createDb(env.DB);
    await seed(db);

    const result = await resolveCityLanding(db, { marketKey: 'zz', citySlug: 'anywhere' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('market_not_found');
  });
});
