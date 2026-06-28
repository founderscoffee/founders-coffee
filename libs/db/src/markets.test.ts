import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { createDb } from './db.js';
import {
  getCityBySlug,
  getMarketByCode,
  getMarketBySlug,
  listCitiesByMarket,
  listMarkets,
} from './markets.js';
import { seed } from './seed.js';

describe('markets + cities queries (real D1)', () => {
  it('reads markets by code and by slug', async () => {
    const db = createDb(env.DB);
    await seed(db);

    expect((await getMarketByCode(db, 'DZ'))?.name).toBe('Algeria');
    expect((await getMarketBySlug(db, 'morocco'))?.code).toBe('MA');
    expect(await getMarketByCode(db, 'XX')).toBeUndefined();
  });

  it('lists markets, optionally filtered by state', async () => {
    const db = createDb(env.DB);
    await seed(db);

    const all = await listMarkets(db);
    expect(all.length).toBeGreaterThanOrEqual(2);

    const visible = await listMarkets(db, { states: ['open', 'active'] });
    expect(visible.every((m) => m.state !== 'dark')).toBe(true);
  });

  it('lists cities by market and fetches by (marketCode, slug)', async () => {
    const db = createDb(env.DB);
    await seed(db);

    const dzCities = await listCitiesByMarket(db, 'DZ');
    expect(dzCities.length).toBeGreaterThanOrEqual(1);
    expect(dzCities.every((c) => c.marketCode === 'DZ')).toBe(true);

    expect((await getCityBySlug(db, 'DZ', 'algiers'))?.name).toBe('Alger');
    expect(await getCityBySlug(db, 'MA', 'algiers')).toBeUndefined();
  });
});
