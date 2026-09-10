import { and, desc, eq, lt, or, sql } from 'drizzle-orm';

import type { Db } from './db.js';
import { visibleIdentity } from './profile-access.js';
import { eventRsvps, events, type Event } from './schema.js';

/**
 * The gatherings a member said they were coming to, from their own side of the RSVP.
 *
 * `hostedEventScope`'s mirror, and deliberately not its twin. A host's own page shows what they
 * ran; this shows what somebody joined, so it reads `event_rsvps` and keeps only `going` — a
 * cancelled RSVP is a gathering the member decided not to attend, and listing it back to them as
 * theirs would be the product disagreeing with a choice it recorded.
 *
 * Cancelled *events* are kept, unlike the hosted scope. A host looking back at their history does
 * not need a meetup that never happened; a member looking at their own list does, because they may
 * still have it in their calendar and the cancellation is the thing they need to see.
 *
 * `visibleIdentity` still gates on the host, so a suppressed host's gathering leaves every
 * attendee's list at the same moment it leaves discovery.
 */
const joinedEventScope = (userId: string, marketCode?: string) =>
  and(
    eq(eventRsvps.userId, userId),
    eq(eventRsvps.status, 'going'),
    visibleIdentity(events.hostId),
    marketCode ? eq(events.marketCode, marketCode) : undefined,
  );

/**
 * One page of what a member has joined, newest first, matching {@link listHostedEvents}.
 *
 * Same ordering and the same cursor shape, because the two lists sit side by side on one screen and
 * a member reading them should not have to hold two mental models of "next page".
 */
export const listJoinedEvents = async (
  db: Db,
  opts: {
    userId: string;
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

  const rows = await db
    .select({ event: events })
    .from(eventRsvps)
    .innerJoin(events, eq(events.id, eventRsvps.eventId))
    .where(and(joinedEventScope(opts.userId, opts.marketCode), cursor))
    .orderBy(desc(events.startsAt), desc(events.id))
    .limit(opts.limit ?? 20);
  return rows.map((row) => row.event);
};

/** How many gatherings that member has joined, over the predicate the pages walk. */
export const countJoinedEvents = async (
  db: Db,
  opts: { userId: string; marketCode?: string },
): Promise<number> => {
  const rows = await db
    .select({ total: sql<number>`count(*)` })
    .from(eventRsvps)
    .innerJoin(events, eq(events.id, eventRsvps.eventId))
    .where(joinedEventScope(opts.userId, opts.marketCode));
  return Number(rows[0]?.total ?? 0);
};
