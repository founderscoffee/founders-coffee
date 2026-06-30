import { and, eq, gt } from 'drizzle-orm';

import type { Db } from './db.js';
import { events, type Event, type Event as EventRow, type NewEvent } from './schema.js';

/** Create a new event row (the caller builds the full object including id + slug). */
export const createEvent = async (db: Db, row: NewEvent): Promise<Event> => {
  const result = await db.insert(events).values(row).returning();
  return result[0];
};

/** Fetch an event by its primary key. */
export const getEvent = async (db: Db, id: string): Promise<Event | undefined> => {
  const rows = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return rows[0];
};

/** Fetch an event by slug within a market (slug is unique per market, not globally). */
export const getEventBySlug = async (
  db: Db,
  marketCode: string,
  slug: string,
): Promise<Event | undefined> => {
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.marketCode, marketCode), eq(events.slug, slug)))
    .limit(1);
  return rows[0];
};

/**
 * List upcoming published events, optionally scoped to a market and/or city. Cursor-based: `after`
 * is a `startsAt` timestamp — only events with `startsAt > after` are returned (ASC order, so the
 * next page continues from the last item's `startsAt`). `limit` caps the page size.
 */
export const listUpcomingEvents = async (
  db: Db,
  opts: {
    marketCode?: string;
    cityCode?: string;
    after?: Date;
    limit?: number;
  } = {},
): Promise<Event[]> => {
  const conditions = [
    eq(events.status, 'published'),
    opts.after ? gt(events.startsAt, opts.after) : gt(events.startsAt, new Date(0)),
  ];
  if (opts.marketCode) conditions.push(eq(events.marketCode, opts.marketCode));
  if (opts.cityCode) conditions.push(eq(events.cityCode, opts.cityCode));

  return db
    .select()
    .from(events)
    .where(and(...conditions))
    .orderBy(events.startsAt)
    .limit(opts.limit ?? 20);
};

/**
 * Atomic status transition — D1-safe check-then-write (no interactive transactions). Returns the
 * number of rows changed (0 = no-op / wrong from-state, 1 = success).
 */
export const transitionEventStatus = async (
  db: Db,
  id: string,
  from: EventRow['status'],
  to: EventRow['status'],
  patch: Partial<NewEvent> = {},
): Promise<number> => {
  const extraSet: Record<string, unknown> = {};
  if (to === 'cancelled') extraSet.cancelledAt = new Date();

  const result = await db
    .update(events)
    .set({ ...patch, ...extraSet, status: to, updatedAt: new Date() })
    .where(and(eq(events.id, id), eq(events.status, from)))
    .run();
  const meta = (result as { meta?: { changes?: number } }).meta;
  return meta?.changes ?? 0;
};

/** Count events by status (for the worker-jobs RECONCILE metric, NFR-7). */
export const countEventsByStatus = async (
  db: Db,
  status: EventRow['status'],
): Promise<number> => {
  const rows = await db.select({ value: events.id }).from(events).where(eq(events.status, status));
  return rows.length;
};

/** Check if a slug is already taken within a market (for slug uniqueness). */
export const isSlugTaken = async (
  db: Db,
  marketCode: string,
  slug: string,
): Promise<boolean> => {
  const existing = await getEventBySlug(db, marketCode, slug);
  return existing !== undefined;
};
