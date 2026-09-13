import { and, desc, eq, gt, lt, or, sql } from 'drizzle-orm';

import type { Db } from './db.js';
import { visibleIdentity } from './profile-access.js';
import {
  events,
  type Event,
  type Event as EventRow,
  type NewEvent,
} from './schema.js';

const ASSUMED_DURATION_SECONDS = 2 * 60 * 60;

/**
 * The published events a visitor can still turn up to.
 *
 * The boundary is the event's *end*, not its start. Dropping an event at `starts_at` would remove a
 * meetup from discovery while people are still walking into the café — the live room stays open
 * until the end for exactly that reason, and a feed that has already forgotten the gathering the
 * live room is hosting contradicts itself. `ends_at` is nullable, so an event without one is
 * assumed to run two hours, the same assumption `isLiveWindowOpen` makes when it decides to close
 * the room. Change one and change the other.
 *
 * The list and the city/state counts share this, so a badge promising four gatherings and a page
 * listing three cannot drift apart.
 *
 * A suppressed host takes their gatherings with them: {@link visibleIdentity} is part of the scope
 * rather than a filter applied afterwards, so the counts cannot describe rows the list refuses.
 */
const upcomingScope = (now: Date) =>
  and(
    sql`coalesce(${events.endsAt}, ${events.startsAt} + ${ASSUMED_DURATION_SECONDS}) > ${Math.floor(now.getTime() / 1000)}`,
    visibleIdentity(events.hostId),
  );

const hostedEventScope = (hostId: string, marketCode?: string) =>
  and(
    eq(events.hostId, hostId),
    eq(events.status, 'published'),
    visibleIdentity(events.hostId),
    marketCode ? eq(events.marketCode, marketCode) : undefined,
  );

/** Create a new event row (the caller builds the full object including id + slug). */
export const createEvent = async (db: Db, row: NewEvent): Promise<Event> => {
  const result = await db.insert(events).values(row).returning();
  return result[0];
};

/** Atomically insert only when the event route key is available in its market. */
export const createEventIfRouteAvailable = async (
  db: Db,
  row: NewEvent,
): Promise<Event | undefined> => {
  const result = await db
    .insert(events)
    .values(row)
    .onConflictDoNothing({ target: [events.marketCode, events.slug] })
    .returning();
  return result[0];
};

/** Fetch an event by its primary key. */
export const getEvent = async (
  db: Db,
  id: string,
): Promise<Event | undefined> => {
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

export type PublicEventSitemapRow = Pick<
  Event,
  'marketCode' | 'cityCode' | 'slug' | 'updatedAt'
>;

export const listPublicEventSitemapRows = async (
  db: Db,
): Promise<PublicEventSitemapRow[]> =>
  db
    .select({
      marketCode: events.marketCode,
      cityCode: events.cityCode,
      slug: events.slug,
      updatedAt: events.updatedAt,
    })
    .from(events)
    .where(and(eq(events.status, 'published'), visibleIdentity(events.hostId)))
    .orderBy(events.updatedAt, events.id);

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
    hostId?: string;
    afterStartsAt?: Date;
    afterId?: string;
    limit?: number;
    now?: Date;
  } = {},
): Promise<Event[]> => {
  const cursor = opts.afterStartsAt
    ? opts.afterId
      ? or(
          gt(events.startsAt, opts.afterStartsAt),
          and(
            eq(events.startsAt, opts.afterStartsAt),
            gt(events.id, opts.afterId),
          ),
        )
      : gt(events.startsAt, opts.afterStartsAt)
    : undefined;

  return db
    .select()
    .from(events)
    .where(
      and(
        upcomingScope(opts.now ?? new Date()),
        cursor,
        eq(events.status, 'published'),
        opts.marketCode ? eq(events.marketCode, opts.marketCode) : undefined,
        opts.cityCode ? eq(events.cityCode, opts.cityCode) : undefined,
        opts.hostId ? eq(events.hostId, opts.hostId) : undefined,
      ),
    )
    .orderBy(events.startsAt, events.id)
    .limit(opts.limit ?? 20);
};

/**
 * One host's event history, newest first, with a composite `(startsAt, id)` cursor.
 *
 * Ordered descending, unlike the discovery feed: a profile answers "what has this person run?",
 * where the most recent gathering is the most informative, while a feed answers "what can I go to
 * next?". The cursor comparison flips with the ordering — `<` rather than `>` — which is why this
 * is its own query rather than a flag on the feed. Both halves of the pair are compared, so events
 * sharing a `startsAt` are never skipped or repeated across a page boundary.
 *
 * Cancelled events are excluded. A cancelled meetup is not evidence that someone hosts, and the
 * count beside the list has to describe the same rows the list shows.
 */
export const listHostedEvents = async (
  db: Db,
  opts: {
    hostId: string;
    marketCode?: string;
    beforeStartsAt?: Date;
    beforeId?: string;
    limit?: number;
  },
): Promise<Event[]> => {
  const cursor = opts.beforeStartsAt
    ? opts.beforeId
      ? or(
          lt(events.startsAt, opts.beforeStartsAt),
          and(
            eq(events.startsAt, opts.beforeStartsAt),
            lt(events.id, opts.beforeId),
          ),
        )
      : lt(events.startsAt, opts.beforeStartsAt)
    : undefined;

  return db
    .select()
    .from(events)
    .where(and(hostedEventScope(opts.hostId, opts.marketCode), cursor))
    .orderBy(desc(events.startsAt), desc(events.id))
    .limit(opts.limit ?? 20);
};

/**
 * How many events that host has run, over the predicate {@link listHostedEvents} pages through.
 *
 * The count and the list share `hostedEventScope` rather than each writing their own `WHERE`, so
 * the number beside a list can never describe a different set of rows than the list itself — which
 * is what happened while the count was the length of the first page.
 */
export const countHostedEvents = async (
  db: Db,
  opts: { hostId: string; marketCode?: string },
): Promise<number> => {
  const rows = await db
    .select({ total: sql<number>`count(*)` })
    .from(events)
    .where(hostedEventScope(opts.hostId, opts.marketCode));
  return Number(rows[0]?.total ?? 0);
};

/**
 * Count upcoming published events per city in a market (for the landing-page city badges). One
 * grouped query — avoids an N+1 per featured city. Returns `{ [cityCode]: count }`.
 */
export const countUpcomingByCity = async (
  db: Db,
  marketCode: string,
  now?: Date,
): Promise<Record<string, number>> => {
  const rows = await db
    .select({ cityCode: events.cityCode, count: sql<number>`count(*)` })
    .from(events)
    .where(
      and(
        eq(events.marketCode, marketCode),
        eq(events.status, 'published'),
        upcomingScope(now ?? new Date()),
      ),
    )
    .groupBy(events.cityCode);
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.cityCode] = Number(row.count);
  return counts;
};

export const countUpcomingByState = async (
  db: Db,
  marketCode: string,
  now?: Date,
): Promise<Record<string, number>> => {
  const rows = await db
    .select({ stateCode: events.stateCode, count: sql<number>`count(*)` })
    .from(events)
    .where(
      and(
        eq(events.marketCode, marketCode),
        eq(events.status, 'published'),
        upcomingScope(now ?? new Date()),
      ),
    )
    .groupBy(events.stateCode);
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.stateCode] = Number(row.count);
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
  const rows = await db
    .select({ value: events.id })
    .from(events)
    .where(eq(events.status, status));
  return rows.length;
};
