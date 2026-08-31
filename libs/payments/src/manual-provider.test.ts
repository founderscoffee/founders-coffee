import { createMoney } from '@founders-coffee/core';
import { createDb, markets, type Db } from '@founders-coffee/db';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { createManualProvider } from './manual-provider.js';
import type { PaymentActor } from './provider.js';

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

const actor: PaymentActor = { userId: 'usr_admin1' };

const initiate = async (db: Db, amountMinor = 2000) =>
  createManualProvider(db).initiate({
    marketCode: 'DZ',
    purpose: 'sponsorship',
    amount: createMoney(amountMinor, 'DZD'),
    billTo: { name: 'Sponsor Co', email: 'ap@sponsor.co' },
  });

const unwrap = async <T>(
  p: Promise<{ ok: true; data: T } | { ok: false; error: unknown }>,
) => {
  const r = await p;
  if (!r.ok) throw new Error('expected ok');
  return r.data;
};

describe('ManualProvider (real D1)', () => {
  it('initiates a pending order + invoice', async () => {
    const db = createDb(env.DB);
    await ensureMarket(db);
    const order = await unwrap(initiate(db, 50_000));
    expect(order.status).toBe('pending');
    expect(order.amountMinor).toBe(50_000);
    expect(order.id).toMatch(/^ord_/);
  });

  it('confirms a pending order (pending → paid)', async () => {
    const db = createDb(env.DB);
    await ensureMarket(db);
    const provider = createManualProvider(db);
    const order = await unwrap(initiate(db));
    const confirmed = await provider.confirm(order.id, actor);
    expect(confirmed.ok).toBe(true);
    if (confirmed.ok) expect(confirmed.data.status).toBe('paid');
  });

  it('confirm is idempotent (double-confirm = same paid order, no error)', async () => {
    const db = createDb(env.DB);
    await ensureMarket(db);
    const provider = createManualProvider(db);
    const order = await unwrap(initiate(db));
    await provider.confirm(order.id, actor);
    const second = await provider.confirm(order.id, actor);
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.data.status).toBe('paid');
  });

  it('cannot confirm a cancelled order', async () => {
    const db = createDb(env.DB);
    await ensureMarket(db);
    const provider = createManualProvider(db);
    const order = await unwrap(initiate(db));
    await provider.cancel(order.id, actor);
    const confirmed = await provider.confirm(order.id, actor);
    expect(confirmed.ok).toBe(false);
  });

  it('refund is rejected from pending and allowed from paid', async () => {
    const db = createDb(env.DB);
    await ensureMarket(db);
    const provider = createManualProvider(db);
    const order = await unwrap(initiate(db));

    const fromPending = await provider.refund(order.id, actor, 'wrong state');
    expect(fromPending.ok).toBe(false);

    await provider.confirm(order.id, actor);
    const fromPaid = await provider.refund(order.id, actor, 'customer request');
    expect(fromPaid.ok).toBe(true);
    if (fromPaid.ok) expect(fromPaid.data.status).toBe('refunded');
  });

  it('returns order_not_found for an unknown id', async () => {
    const db = createDb(env.DB);
    const result = await createManualProvider(db).confirm('ord_missing', actor);
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error).toHaveProperty('code', 'order_not_found');
  });
});
