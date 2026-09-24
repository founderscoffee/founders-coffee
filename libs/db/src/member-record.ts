import { and, eq, gte, inArray, sql } from 'drizzle-orm';

import type { Db } from './db.js';
import { OPERATIONS_RETENTION_DAYS } from './operations-retention.js';
import { eventAttendance, eventCloseouts, events } from './schema.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Where a public profile's meetup record starts: the retention period ago.
 *
 * Closeouts and attendance are deleted once they pass that age, so a count over a longer window
 * would shrink as rows retired and a member active three years ago would read as new. Counting over
 * exactly the retention period, and saying so on the profile, keeps the figure true on any day.
 * The window is measured on the meetup's own start rather than on when anything was recorded,
 * because "the last two years" is a claim about when the meetups happened.
 */
export const meetupRecordSince = (now: Date): Date =>
  new Date(now.getTime() - OPERATIONS_RETENTION_DAYS * DAY_MS);

/**
 * What puts a meetup on a public profile's record: its closeout says it was held, and it started
 * inside the window.
 *
 * Both counts and the hosted list's tags go through this one condition, so the figure above a
 * host's list and the meetups tagged in it cannot disagree about which ones took place.
 */
const onRecord = (now: Date) =>
  and(
    eq(eventCloseouts.outcome, 'held'),
    gte(events.startsAt, meetupRecordSince(now)),
  );

/**
 * How many meetups in the window a member attended, by their hosts' records.
 *
 * Only `attended` rows count, and only at meetups whose closeout says they were held: a no-show is
 * never a number on a profile, and a meetup the host reported as not happening is not one anybody
 * attended, which is what the did-not-happen notice promises the members who were going.
 */
export const countAttendedMeetups = async (
  db: Db,
  userId: string,
  now: Date,
): Promise<number> => {
  const rows = await db
    .select({ total: sql<number>`count(*)` })
    .from(eventAttendance)
    .innerJoin(events, eq(events.id, eventAttendance.eventId))
    .innerJoin(eventCloseouts, eq(eventCloseouts.eventId, events.id))
    .where(
      and(
        eq(eventAttendance.userId, userId),
        eq(eventAttendance.outcome, 'attended'),
        onRecord(now),
      ),
    );
  return Number(rows[0]?.total ?? 0);
};

/**
 * How many meetups in the window a member hosted that took place, by their closeouts.
 *
 * A meetup counts once its closeout says it was held. One reported as not happening is left out
 * rather than counted against anybody, and no total of what was scheduled is ever set beside this,
 * because the profile publishes what happened, never a rate (#92).
 */
export const countHostedMeetups = async (
  db: Db,
  hostId: string,
  now: Date,
): Promise<number> => {
  const rows = await db
    .select({ total: sql<number>`count(*)` })
    .from(events)
    .innerJoin(eventCloseouts, eq(eventCloseouts.eventId, events.id))
    .where(and(eq(events.hostId, hostId), onRecord(now)));
  return Number(rows[0]?.total ?? 0);
};

/**
 * Which of these meetups are on their host's record: the ones {@link countHostedMeetups} counts.
 *
 * The public profile tags each of them in the host's list, so the count above the list is the
 * number of tagged meetups in it. A meetup without the tag is one nobody has confirmed: upcoming,
 * never closed out, reported as not happening, or older than the window. The tag does not say
 * which, so a missing tag never reads as a failure.
 */
export const hostedMeetupsOnRecord = async (
  db: Db,
  hostId: string,
  eventIds: readonly string[],
  now: Date,
): Promise<ReadonlySet<string>> => {
  if (eventIds.length === 0) return new Set();
  const rows = await db
    .select({ id: events.id })
    .from(events)
    .innerJoin(eventCloseouts, eq(eventCloseouts.eventId, events.id))
    .where(
      and(
        eq(events.hostId, hostId),
        inArray(events.id, [...eventIds]),
        onRecord(now),
      ),
    );
  return new Set(rows.map((row) => row.id));
};
