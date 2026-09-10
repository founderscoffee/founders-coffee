import { and, eq, sql } from 'drizzle-orm';

import { batch } from './atomic.js';
import type { Db } from './db.js';
import { auditStatement } from './operations-audit.js';
import { eventAttendance, events, type EventAttendanceRow } from './schema.js';

export type AttendanceOutcome =
  'recorded' | 'not_host' | 'not_eligible' | 'not_ended' | 'event_cancelled';

/**
 * The member held a going RSVP for this event, and the caller hosts it.
 *
 * §5.4 scopes registered attendance to members who said they were coming: a host may record an
 * outcome for someone on their own going list and for nobody else. Enforced inside the write, so an
 * ineligible member produces no row rather than a row the caller has to remember to reject.
 *
 * The RSVP is checked as it stands now, which is safe precisely because §5.17 froze it at
 * `startsAt`. Without that freeze this predicate would be a race — someone could cancel their RSVP
 * after the meetup and erase their own no-show — and the two rules only work as a pair.
 *
 * Everything reads from `events` with the RSVP as an `EXISTS`, so this one predicate can guard both
 * statements in the batch. It used to be a join for the write and a looser predicate for the audit,
 * and the two drifted: a refused write still produced an audit entry saying a non-host had changed
 * an attendance outcome. A guard that has to be written twice is a guard that will differ.
 */
const eligibleAttendee = (eventId: string, userId: string, hostId: string) =>
  sql`events.id = ${eventId}
      AND events.host_id = ${hostId}
      AND events.status != 'cancelled'
      AND events.ends_at IS NOT NULL
      AND events.ends_at <= unixepoch()
      AND EXISTS (
        SELECT 1 FROM event_rsvps
        WHERE event_id = ${eventId}
          AND user_id = ${userId}
          AND status = 'going')`;

/**
 * Which of four reasons the guard refused, asked only after it has already refused.
 *
 * A read taken after the decision can only mislabel an error message; the same read taken before
 * the write would have authorized one. The order is the point, not an optimisation.
 *
 * The clauses are tried in the order the guard evaluates them, so the answer names the first
 * obstacle rather than an arbitrary one: a stranger marking an attendee of a cancelled event is
 * told they do not host it, which is the thing they would have to fix first.
 */
const refusalFor = async (
  db: Db,
  eventId: string,
  hostId: string,
): Promise<AttendanceOutcome> => {
  const rows = await db
    .select({
      hostId: events.hostId,
      endsAt: events.endsAt,
      status: events.status,
    })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  const event = rows[0];
  if (!event || event.hostId !== hostId) return 'not_host';
  if (event.status === 'cancelled') return 'event_cancelled';
  if (event.endsAt === null || event.endsAt.getTime() > Date.now())
    return 'not_ended';
  return 'not_eligible';
};

/**
 * Record one member's outcome, or update the one already there.
 *
 * `ON CONFLICT (event_id, user_id) DO UPDATE` is what makes a host correcting themselves mid-list
 * idempotent: marking the same person twice moves one row rather than adding a second. The audit
 * entry distinguishes the two — a first record and a change are different actions, and the caller
 * says which.
 *
 * Geography is copied from the event in the same statement, never accepted from the caller, for
 * the reason §5.19 exists: an operations row filed under the wrong market is invisible to the
 * market it belongs to and inflates one it does not.
 */
export const recordAttendance = async (
  db: Db,
  input: {
    eventId: string;
    userId: string;
    hostId: string;
    outcome: 'attended' | 'no_show';
    rowId: string;
    auditId: string;
    accessSubject?: string | null;
    isCorrection?: boolean;
    reason?: string | null;
  },
): Promise<{ outcome: AttendanceOutcome; row?: EventAttendanceRow }> => {
  const guard = eligibleAttendee(input.eventId, input.userId, input.hostId);

  const [written] = await batch(db, [
    db
      .insert(eventAttendance)
      .select(
        db
          .select({
            id: sql<string>`${input.rowId}`.as('id'),
            eventId: sql<string>`${input.eventId}`.as('event_id'),
            userId: sql<string>`${input.userId}`.as('user_id'),
            marketCode: events.marketCode,
            stateCode: events.stateCode,
            cityCode: events.cityCode,
            outcome: sql<string>`${input.outcome}`.as('outcome'),
            recordedByUserId: sql<string>`${input.hostId}`.as(
              'recorded_by_user_id',
            ),
            recordedAt: sql<number>`unixepoch()`.as('recorded_at'),
            updatedAt: sql<number>`unixepoch()`.as('updated_at'),
          })
          .from(events)
          .where(guard),
      )
      .onConflictDoUpdate({
        target: [eventAttendance.eventId, eventAttendance.userId],
        set: { outcome: input.outcome, updatedAt: new Date() },
      }),
    auditStatement(
      db,
      {
        id: input.auditId,
        actorUserId: input.hostId,
        accessSubject: input.accessSubject ?? null,
        action: input.isCorrection
          ? 'attendance_corrected'
          : 'attendance_recorded',
        targetType: 'attendance',
        targetId: `${input.eventId}:${input.userId}`,
        reasonCode: input.reason ?? null,
        metadata: { after: input.outcome },
      },
      events,
      events.marketCode,
      guard,
    ),
  ]);

  if (!(written as { meta?: { changes?: number } })?.meta?.changes)
    return {
      outcome: await refusalFor(db, input.eventId, input.hostId),
    };

  const rows = await db
    .select()
    .from(eventAttendance)
    .where(
      and(
        eq(eventAttendance.eventId, input.eventId),
        eq(eventAttendance.userId, input.userId),
      ),
    )
    .limit(1);
  return { outcome: 'recorded', row: rows[0] };
};

/** Every recorded outcome for one event, for the host's list and the metric queries alike. */
export const listAttendance = (
  db: Db,
  eventId: string,
): Promise<EventAttendanceRow[]> =>
  db.select().from(eventAttendance).where(eq(eventAttendance.eventId, eventId));

/**
 * The counts §6 divides, taken from the rows rather than from anything a client sent.
 *
 * §5.5 makes every closeout count derived. A host cannot submit a total that disagrees with the
 * outcomes recorded, because no total is submitted: the walk-in aggregate is added to this at read
 * time and the two are never stored as one number.
 */
export const attendanceTally = async (
  db: Db,
  eventId: string,
): Promise<{ attended: number; noShow: number }> => {
  const rows = await db
    .select({
      outcome: eventAttendance.outcome,
      count: sql<number>`count(*)`.as('count'),
    })
    .from(eventAttendance)
    .where(eq(eventAttendance.eventId, eventId))
    .groupBy(eventAttendance.outcome);
  return {
    attended: rows.find((row) => row.outcome === 'attended')?.count ?? 0,
    noShow: rows.find((row) => row.outcome === 'no_show')?.count ?? 0,
  };
};
