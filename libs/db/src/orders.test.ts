import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { createDb } from './db.js';
import {
  createInvoice,
  createOrder,
  getInvoiceByOrderId,
  getOrder,
  transitionStatus,
} from './orders.js';
import { markets, type Db } from './index.js';

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
      featureFlags: { events: true, hackathons: false, payments: true, recruiting: false },
    })
    .onConflictDoNothing()
    .run();
};

describe('orders + invoices repository (real D1)', () => {
  it('creates and fetches an order', async () => {
    const db = createDb(env.DB);
    await ensureMarket(db);
    const order = await createOrder(db, {
      id: 'ord_c1',
      marketCode: 'DZ',
      purpose: 'sponsorship',
      amountMinor: 50_000,
      currency: 'DZD',
      status: 'pending',
      provider: 'manual',
    });
    expect(order.id).toBe('ord_c1');
    expect(order.status).toBe('pending');
    const fetched = await getOrder(db, 'ord_c1');
    expect(fetched?.amountMinor).toBe(50_000);
  });

  it('transitionStatus updates only when the from-status matches', async () => {
    const db = createDb(env.DB);
    await ensureMarket(db);
    await createOrder(db, {
      id: 'ord_t1',
      marketCode: 'DZ',
      purpose: 'host_fee',
      amountMinor: 1000,
      currency: 'DZD',
      status: 'pending',
      provider: 'manual',
    });

    const changed = await transitionStatus(db, 'ord_t1', 'pending', 'paid', {
      paidAt: new Date(),
    });
    expect(changed).toBe(1);
    expect((await getOrder(db, 'ord_t1'))?.status).toBe('paid');

    const again = await transitionStatus(db, 'ord_t1', 'pending', 'paid');
    expect(again).toBe(0);
  });

  it('creates and fetches an invoice by order (1:1)', async () => {
    const db = createDb(env.DB);
    await ensureMarket(db);
    await createOrder(db, {
      id: 'ord_i1',
      marketCode: 'DZ',
      purpose: 'sponsorship',
      amountMinor: 20_000,
      currency: 'DZD',
      status: 'pending',
      provider: 'manual',
    });
    const invoice = await createInvoice(db, {
      id: 'inv_i1',
      orderId: 'ord_i1',
      number: 'INV-i1',
      billToName: 'Sponsor Co',
      billToEmail: 'ap@sponsor.co',
      amountMinor: 20_000,
      currency: 'DZD',
    });
    expect(invoice.orderId).toBe('ord_i1');
    expect((await getInvoiceByOrderId(db, 'ord_i1'))?.number).toBe('INV-i1');
  });
});
