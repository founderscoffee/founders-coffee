import { and, eq, gt, or, sql } from 'drizzle-orm';

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
 * List upcoming published events, optionally scoped to a market and/or city. Cursor-based with a
 * **composite `(startsAt, id)` cursor** so events sharing a `startsAt` are never skipped: ordered
 * `startsAt, id` ASC, and the cursor is `afterStartsAt` + `afterId` (continue strictly after that
 * pair). If only `afterStartsAt` is given (no `afterId`), falls back to `startsAt > afterStartsAt`.
 * `limit` caps the page size.
 */
export const listUpcomingEvents = async (
  db: Db,
  opts: {
    marketCode?: string;
    cityCode?: string;
    afterStartsAt?: Date;
    afterId?: string;
    limit?: number;
  } = {},
): Promise<Event[]> => {
  const cursor = opts.afterStartsAt
    ? opts.afterId
      ? or(
          gt(events.startsAt, opts.afterStartsAt),
          and(eq(events.startsAt, opts.afterStartsAt), gt(events.id, opts.afterId)),
        )
      : gt(events.startsAt, opts.afterStartsAt)
    : gt(events.startsAt, new Date(0));

  return db
    .select()
    .from(events)
    .where(
      and(
        cursor,
        eq(events.status, 'published'),
        opts.marketCode ? eq(events.marketCode, opts.marketCode) : undefined,
        opts.cityCode ? eq(events.cityCode, opts.cityCode) : undefined,
      ),
    )
    .orderBy(events.startsAt, events.id)
    .limit(opts.limit ?? 20);
};

/**
 * Count upcoming published events per city in a market (for the landing-page city badges). One
 * grouped query — avoids an N+1 per featured city. Returns `{ [cityCode]: count }`.
 */
export const countUpcomingByCity = async (
  db: Db,
  marketCode: string,
): Promise<Record<string, number>> => {
  const rows = await db
    .select({ cityCode: events.cityCode, count: sql<number>`count(*)` })
    .from(events)
    .where(
      and(eq(events.marketCode, marketCode), eq(events.status, 'published'), gt(events.startsAt, new Date())),
    )
    .groupBy(events.cityCode);
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.cityCode] = Number(row.count);
  return counts;
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
