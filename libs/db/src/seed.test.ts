import { count, eq } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { createDb } from './db.js';
import { cities, markets } from './schema.js';
import { SEED_CITIES, SEED_MARKETS, seed } from './seed.js';

describe('libs/db seed (real D1 via Miniflare)', () => {
  const db = createDb(env.DB);

  it('seeds the two launch markets with launch config', async () => {
    await seed(db);

    const rows = await db.select().from(markets).all();
    expect(rows.map((m) => m.code).sort()).toEqual(['DZ', 'MA']);

    const dz = rows.find((m) => m.code === 'DZ');
    expect(dz?.state).toBe('active');
    expect(dz?.defaultCurrency).toBe('DZD');
    expect(dz?.defaultLocale).toBe('ar');
    expect(dz?.direction).toBe('rtl');
    expect(dz?.featureFlags).toEqual({
      events: true,
      hackathons: false,
      payments: false,
      recruiting: false,
    });

    const ma = rows.find((m) => m.code === 'MA');
    expect(ma?.state).toBe('open');
    expect(ma?.defaultCurrency).toBe('MAD');
  });

  it('seeds major cities scoped to each market (FR-G5)', async () => {
    const dzCities = await db
      .select()
      .from(cities)
      .where(eq(cities.marketCode, 'DZ'))
      .all();
    expect(dzCities.map((c) => c.slug).sort()).toContain('algiers');
    expect(dzCities.length).toBe(5);

    const maCities = await db
      .select()
      .from(cities)
      .where(eq(cities.marketCode, 'MA'))
      .all();
    expect(maCities.map((c) => c.slug)).toContain('casablanca');
    expect(maCities.length).toBe(5);

    const allCities = await db.select().from(cities).all();
    const codes = new Set(SEED_MARKETS.map((m) => m.code));
    for (const c of allCities) expect(codes.has(c.marketCode)).toBe(true);
  });

  it('is idempotent — re-running neither duplicates nor overwrites', async () => {
    await seed(db);
    await seed(db);

    const [{ marketTotal }] = await db.select({ marketTotal: count() }).from(markets);
    const [{ cityTotal }] = await db.select({ cityTotal: count() }).from(cities);
    expect(marketTotal).toBe(SEED_MARKETS.length);
    expect(cityTotal).toBe(SEED_CITIES.length);
  });
});
