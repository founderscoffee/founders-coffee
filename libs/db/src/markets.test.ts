import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { createDb } from './db.js';
import { getMarketByCode, getMarketBySlug, listMarkets } from './markets.js';
import { seed } from './seed.js';

describe('markets queries (real D1)', () => {
  it('reads markets by code and by slug', async () => {
    const db = createDb(env.DB);
    await seed(db);

    expect((await getMarketByCode(db, 'DZ'))?.name).toBe('Algeria');
    expect((await getMarketBySlug(db, 'egypt'))?.code).toBe('EG');
    expect(await getMarketByCode(db, 'XX')).toBeUndefined();
  });

  it('lists markets, optionally filtered by state', async () => {
    const db = createDb(env.DB);
    await seed(db);

    const all = await listMarkets(db);
    expect(all.length).toBe(3);

    const visible = await listMarkets(db, { states: ['open', 'active'] });
    expect(visible.every((m) => m.state !== 'dark')).toBe(true);
  });
});
