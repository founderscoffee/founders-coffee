import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, it } from 'vitest';

import { createDb, eq, markets, seed, type Db } from '@founders-coffee/db';

import { listVisibleMarkets } from './resolver.js';
import { cachedVisibleMarkets } from './visible-cache.js';

const codes = (list: readonly { readonly code: string }[]) =>
  list.map((market) => market.code).sort();

const setEgypt = (db: Db, state: 'active' | 'dark') =>
  db.update(markets).set({ state }).where(eq(markets.code, 'EG')).run();

const setupDb = async (): Promise<Db> => {
  const db = createDb(env.DB);
  await seed(db);
  await setEgypt(db, 'active');
  return db;
};

describe('the visible markets, kept by each data centre (#114)', () => {
  afterEach(async () => {
    await setEgypt(createDb(env.DB), 'active');
  });

  it('lists what D1 lists when it has no copy yet', async () => {
    const db = await setupDb();

    expect(await cachedVisibleMarkets(db, 'https://first.test')).toEqual(
      await listVisibleMarkets(db),
    );
  });

  it('answers the next read from its copy rather than from D1', async () => {
    const db = await setupDb();
    const origin = 'https://kept.test';
    const first = await cachedVisibleMarkets(db, origin);
    await setEgypt(db, 'dark');

    expect(codes(await cachedVisibleMarkets(db, origin))).toEqual(codes(first));
    expect(codes(await listVisibleMarkets(db))).not.toContain('EG');
  });

  it("keeps one copy per origin, so staging never answers with production's", async () => {
    const db = await setupDb();
    await cachedVisibleMarkets(db, 'https://production.test');
    await setEgypt(db, 'dark');

    expect(
      codes(await cachedVisibleMarkets(db, 'https://staging.test')),
    ).not.toContain('EG');
  });
});
