import { eq } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { batch } from './atomic.js';
import { createDb } from './db.js';
import { cities, markets, users } from './schema.js';

describe('libs/db (real D1 via Miniflare)', () => {
  it('round-trips market + city + user', async () => {
    const db = createDb(env.DB);
    await db
      .insert(markets)
      .values({
        code: 'DZ',
        name: 'Algeria',
        slug: 'algeria',
        defaultLocale: 'fr-DZ',
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
      })
      .run();
    await db
      .insert(cities)
      .values({
        id: 'city_algiers',
        marketCode: 'DZ',
        name: 'Algiers',
        slug: 'algiers',
        timezone: 'Africa/Algiers',
      })
      .run();
    await db
      .insert(users)
      .values({
        id: 'usr_m1',
        email: 'founder@example.dz',
        role: 'member',
        homeMarketCode: 'DZ',
        homeCityId: 'city_algiers',
      })
      .run();

    const market = await db.select().from(markets).where(eq(markets.code, 'DZ')).all();
    expect(market[0]?.defaultCurrency).toBe('DZD');

    const user = await db.select().from(users).where(eq(users.id, 'usr_m1')).all();
    expect(user[0]?.email).toBe('founder@example.dz');
  });

  it('batch executes statements atomically', async () => {
    const db = createDb(env.DB);
    await batch(db, [
      db.insert(users).values({ id: 'usr_b1', role: 'member' }),
      db.insert(users).values({ id: 'usr_b2', role: 'member' }),
    ]);
    const rows = await db.select().from(users).all();
    expect(rows.map((u) => u.id)).toEqual(
      expect.arrayContaining(['usr_b1', 'usr_b2']),
    );
  });
});
