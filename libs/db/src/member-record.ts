import { and, eq, gte, sql } from 'drizzle-orm';

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
        eq(eventCloseouts.outcome, 'held'),
        gte(events.startsAt, meetupRecordSince(now)),
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
    .where(
      and(
        eq(events.hostId, hostId),
        eq(eventCloseouts.outcome, 'held'),
        gte(events.startsAt, meetupRecordSince(now)),
      ),
    );
  return Number(rows[0]?.total ?? 0);
};
