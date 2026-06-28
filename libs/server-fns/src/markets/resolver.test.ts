import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createDb, markets as marketsTable, seed, type Db } from '@founders-coffee/db';

import { getMarketWithCities, listVisibleMarkets, resolveMarket } from './resolver.js';

/** Seed a dark market to verify it is hidden from public resolution. */
const seedDarkMarket = async (db: Db): Promise<void> => {
  await db
    .insert(marketsTable)
    .values({
      code: 'EG',
      name: 'Egypt',
      slug: 'egypt',
      defaultLocale: 'ar',
      defaultCurrency: 'EGP',
      timezone: 'Africa/Cairo',
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
    const bySlug = await resolveMarket(db, { slug: 'morocco' });

    expect(byCode.ok).toBe(true);
    if (byCode.ok) expect(byCode.data.code).toBe('DZ');
    expect(bySlug.ok).toBe(true);
    if (bySlug.ok) expect(bySlug.data.code).toBe('MA');
  });

  it('hides dark markets (no existence leak) and unknown codes', async () => {
    const db = createDb(env.DB);
    await seed(db);
    await seedDarkMarket(db);

    const dark = await resolveMarket(db, { code: 'EG' });
    expect(dark.ok).toBe(false);
    if (!dark.ok) expect(dark.error.code).toBe('market_not_found');

    const unknown = await resolveMarket(db, { code: 'ZZ' });
    expect(unknown.ok).toBe(false);
  });

  it('resolves a market with its cities (FR-G6)', async () => {
    const db = createDb(env.DB);
    await seed(db);

    const result = await getMarketWithCities(db, 'DZ');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.market.code).toBe('DZ');
      expect(result.data.cities.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('lists only visible markets (dark excluded)', async () => {
    const db = createDb(env.DB);
    await seed(db);
    await seedDarkMarket(db);

    const visible = await listVisibleMarkets(db);

    expect(visible.every((m) => m.state !== 'dark')).toBe(true);
    expect(visible.find((m) => m.code === 'EG')).toBeUndefined();
  });
});
