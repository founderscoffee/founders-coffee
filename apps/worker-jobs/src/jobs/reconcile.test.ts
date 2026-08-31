import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createDb, createOrder, markets, type Db } from '@founders-coffee/db';

import { runReconcile } from './reconcile.js';

/** Orders reference markets via FK — seed DZ idempotently (shared D1 per file). */
const ensureMarket = async (db: Db): Promise<void> => {
  await db
    .insert(markets)
    .values({
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
        payments: true,
        recruiting: false,
      },
    })
    .onConflictDoNothing()
    .run();
};

describe('runReconcile (real D1)', () => {
  it('counts pending orders and returns the backlog', async () => {
    const db = createDb(env.DB);
    await ensureMarket(db);
    await createOrder(db, {
      id: 'ord_rec1',
      marketCode: 'DZ',
      purpose: 'sponsorship',
      amountMinor: 1000,
      currency: 'DZD',
      status: 'pending',
      provider: 'manual',
    });

    const result = await runReconcile(db);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.pending).toBeGreaterThanOrEqual(1);
  });
});
