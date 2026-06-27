import { and, eq } from 'drizzle-orm';

import type { Db } from './db.js';
import {
  invoices,
  orders,
  type Invoice,
  type NewInvoice,
  type NewOrder,
  type Order,
  type OrderStatus,
} from './schema.js';

/** Insert a fully-formed Order row (the provider generates the id). */
export const createOrder = async (db: Db, row: NewOrder): Promise<Order> => {
  const result = await db.insert(orders).values(row).returning();
  return result[0];
};

/** Fetch an Order by id. */
export const getOrder = async (db: Db, id: string): Promise<Order | undefined> => {
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return rows[0];
};

/**
 * Atomically transition an Order's status: `UPDATE … WHERE id=? AND status=?`.
 * Returns the rows-changed count (1 on success, 0 if `from` didn't match — the
 * idempotency / race guard for confirms). D1 has no interactive transactions
 * (AGENTS.md §11); this single atomic statement is the safe check-then-write.
 */
export const transitionStatus = async (
  db: Db,
  id: string,
  from: OrderStatus,
  to: OrderStatus,
  patch: Partial<NewOrder> = {},
): Promise<number> => {
  const result = await db
    .update(orders)
    .set({ ...patch, status: to, updatedAt: new Date() })
    .where(and(eq(orders.id, id), eq(orders.status, from)))
    .run();
  const meta = (result as { meta?: { changes?: number } }).meta;
  return meta?.changes ?? 0;
};

/** Insert a fully-formed Invoice row (1:1 with an Order). */
export const createInvoice = async (db: Db, row: NewInvoice): Promise<Invoice> => {
  const result = await db.insert(invoices).values(row).returning();
  return result[0];
};

/** Fetch the Invoice for an Order (1:1). */
export const getInvoiceByOrderId = async (db: Db, orderId: string): Promise<Invoice | undefined> => {
  const rows = await db.select().from(invoices).where(eq(invoices.orderId, orderId)).limit(1);
  return rows[0];
};
