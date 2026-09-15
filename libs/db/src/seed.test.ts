import { count } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { createDb } from './db.js';
import { markets } from './schema.js';
import { SEED_MARKETS, seed } from './seed.js';

describe('libs/db seed (real D1 via Miniflare)', () => {
  const db = createDb(env.DB);

  it('seeds the three launch markets with launch config', async () => {
    await seed(db);

    const rows = await db.select().from(markets).all();
    expect(rows.map((m) => m.code).sort()).toEqual(['DZ', 'EG', 'SA']);

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
      communityOperations: true,
    });

    const eg = rows.find((m) => m.code === 'EG');
    expect(eg?.state).toBe('active');
    expect(eg?.defaultCurrency).toBe('EGP');
    expect(eg?.featureFlags?.communityOperations).toBe(true);

    const sa = rows.find((m) => m.code === 'SA');
    expect(sa?.state).toBe('active');
    expect(sa?.defaultCurrency).toBe('SAR');
    expect(sa?.featureFlags?.communityOperations).toBe(true);
  });

  it('is idempotent — re-running neither duplicates nor overwrites', async () => {
    await seed(db);
    await seed(db);

    const [{ marketTotal }] = await db
      .select({ marketTotal: count() })
      .from(markets);
    expect(marketTotal).toBe(SEED_MARKETS.length);
  });
});
