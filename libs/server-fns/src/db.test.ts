import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { getMarketByCode, seed } from '@founders-coffee/db';

import { getDb } from './db.js';

/**
 * `getDb()` is the env-injection primitive (P0-012 → P1-017): it reaches the D1 binding
 * through the Workers `cloudflare:workers` env with no caller-supplied arg. Seeding the
 * pool's Miniflare D1 + reading back through the Drizzle handle `getDb()` returns proves the
 * full `env.DB → createDb → query` path. The `createServerFn` wrappers are thin glue over
 * `getDb` + `handleResult` + the resolver (each unit-tested elsewhere); their composition is
 * exercised by apps/ui routes (P1-002).
 */
describe('getDb (cloudflare:workers env-injection)', () => {
  it('resolves a queryable D1 handle from the Workers env', async () => {
    const db = getDb();
    await seed(db);

    const market = await getMarketByCode(db, 'DZ');

    expect(market?.code).toBe('DZ');
  });

  it('reads the same binding the pool seeds (createDb(env.DB))', async () => {
    await seed(getDb());

    expect(env.DB).toBeDefined();
    const market = await getMarketByCode(getDb(), 'DZ');

    expect(market?.code).toBe('DZ');
  });
});
