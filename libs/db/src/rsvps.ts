import { and, eq, inArray, sql } from 'drizzle-orm';

import type { RsvpCreationOutcome } from '@founders-coffee/core';

import { batch } from './atomic.js';
import type { Db } from './db.js';
import { eventRsvps, events, user, type EventRsvp } from './schema.js';

export type CreateRsvpOutcome = RsvpCreationOutcome;

export const RSVP_INSERT_COLUMNS = [
  'id',
  'event_id',
  'user_id',
  'status',
  'created_at',
  'updated_at',
] as const;

/**
 * True when a driver error is the `UNIQUE(event_id, user_id)` violation on `event_rsvps`, i.e. the
 * user already holds an RSVP for this event.
 *
 * D1 reports it as `UNIQUE constraint failed: event_rsvps.event_id, event_rsvps.user_id`. The
 * columns are matched as well as the constraint text, so a unique violation on some other table
 * inside the same batch is never swallowed as `already_rsvpd`. The `cause` chain is walked because
 * Drizzle replaces `message` with the failed SQL on some code paths and keeps the driver error as
 * the cause; a version that starts doing so for batches would otherwise silently turn a duplicate
 * into an untyped throw. `isDuplicateRsvpMessage` is asserted against the live D1 text by test.
 */
const isDuplicateRsvpMessage = (message: string): boolean =>
  message.includes('UNIQUE constraint failed') &&
  (message.includes('event_rsvps.event_id') ||
    message.includes('event_rsvps_event_id_user_id_unique'));

export const isDuplicateRsvpError = (error: unknown): boolean => {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const message =
      current instanceof Error ? current.message : String(current);
    if (isDuplicateRsvpMessage(message)) return true;
    current = current instanceof Error ? current.cause : undefined;
  }
  return false;
};

const eventExists = (eventId: string) => sql`id = ${eventId}`;

/**
 * The event exists and has not started, decided by the database's own clock.
 *
 * §5.17 freezes RSVP intent at `startsAt` so that the going set used for attendance eligibility
 * cannot be edited after the fact — someone who did not turn up must not be able to erase having
 * said they would. The comparison is `unixepoch()` inside the statement rather than a timestamp
 * passed in, because a caller's clock is an input and this is the boundary the whole eligibility
 * model rests on. Evaluating it in the same conditional write as the mutation is also what makes
 * the boundary exact: there is no window between checking and acting.
 */
const eventOpenForRsvp = (eventId: string) =>
  sql`id = ${eventId} AND starts_at > unixepoch()`;

/**
 * Create an RSVP, writing nothing at all when the event has vanished (AGENTS.md §11 — atomic
 * single-statement SQL, never read-then-write).
 *
 * The insert selects its row *from* `events`, so it produces one row when the event is there and
 * none when it is not — the caller checked a moment earlier, but a cancelled or deleted event
 * between that read and this write must not leave an orphan attendee. Its value list must line up
 * with the column list Drizzle generates from the schema, which `RSVP_INSERT_COLUMNS` pins by test
 * — a column added to `event_rsvps` would otherwise widen that list and break the insert at runtime
 * only. The counter update carries the same predicate and runs in the same D1 batch, so both
 * observe one snapshot of `events` and either both apply or neither does.
 *
 * Concurrency: D1 serializes the batches, so the counter and the attendee rows can never disagree.
 * A concurrent duplicate by the same user violates `UNIQUE(event_id, user_id)`, which rolls the
 * whole batch back and surfaces here as `already_rsvpd` rather than an untyped throw
 * (AGENTS.md §16).
 */
export const createRsvp = async (
  db: Db,
  opts: {
    id: string;
    eventId: string;
    userId: string;
  },
): Promise<{ outcome: CreateRsvpOutcome }> => {
  try {
    const results = await batch(db, [
      db.insert(eventRsvps).select(
        sql`SELECT ${opts.id}, ${opts.eventId}, ${opts.userId}, 'going', unixepoch(), unixepoch()
            FROM events WHERE ${eventOpenForRsvp(opts.eventId)}`,
      ),
      db
        .update(events)
        .set({ rsvps: sql`rsvps + 1` })
        .where(eventOpenForRsvp(opts.eventId)),
    ]);

    const insertResult = results[0] as { meta?: { changes?: number } };
    const inserted = insertResult.meta?.changes ?? 0;
    if (inserted === 1) return { outcome: 'created' };
    const live = await db
      .select({ id: events.id })
      .from(events)
      .where(eventExists(opts.eventId))
      .limit(1);
    return { outcome: live.length > 0 ? 'rsvp_closed' : 'event_missing' };
  } catch (error) {
    if (isDuplicateRsvpError(error)) return { outcome: 'already_rsvpd' };
    throw error;
  }
};

/**
 * Cancel (hard-delete) an RSVP and decrement the denormalized counter in one D1 batch, so a row can
 * never be removed without its counter following (AGENTS.md §11).
 *
 * The decrement is written first and gated on the RSVP still existing, so it reads `event_rsvps`
 * before the delete removes the row. Cancelling something that was never there decrements nothing,
 * and two concurrent cancels decrement once: the loser's `EXISTS` finds no row. The `rsvps > 0`
 * guard is belt-and-braces against pre-existing drift.
 *
 * Both statements also require the event not to have started. Withdrawing after the fact is the
 * side of the freeze that matters most: without it, a member who said yes and did not come could
 * delete the evidence, and the attendance a host records would be of a set that no longer exists.
 * `deleted: false` for a started event is the same answer as for an RSVP that was never there, so
 * the caller distinguishes them rather than the statement.
 */
export const cancelRsvp = async (
  db: Db,
  opts: {
    eventId: string;
    userId: string;
  },
): Promise<{ deleted: boolean }> => {
  const results = await batch(db, [
    db
      .update(events)
      .set({ rsvps: sql`rsvps - 1` })
      .where(
        sql`id = ${opts.eventId} AND rsvps > 0 AND starts_at > unixepoch() AND EXISTS (
              SELECT 1 FROM event_rsvps
              WHERE event_id = ${opts.eventId} AND user_id = ${opts.userId}
            )`,
      ),
    db.delete(eventRsvps).where(
      sql`event_id = ${opts.eventId} AND user_id = ${opts.userId}
          AND EXISTS (
            SELECT 1 FROM events WHERE id = ${opts.eventId} AND starts_at > unixepoch()
          )`,
    ),
  ]);

  const deleteResult = results[1] as { meta?: { changes?: number } };
  return { deleted: (deleteResult.meta?.changes ?? 0) > 0 };
};

/**
 * Get a user's RSVP for a specific event. Returns `undefined` if not RSVP'd.
 */
export const getRsvpForUser = async (
  db: Db,
  opts: {
    eventId: string;
    userId: string;
  },
): Promise<EventRsvp | undefined> => {
  const rows = await db
    .select()
    .from(eventRsvps)
    .where(
      and(
        eq(eventRsvps.eventId, opts.eventId),
        eq(eventRsvps.userId, opts.userId),
      ),
    )
    .limit(1);
  return rows[0];
};

/**
 * Get a user's RSVPs for multiple events (batch lookup). Returns a map of
 * eventId → status. Used by `attachAttendance` to populate `viewerRsvp`
 * without N+1 queries.
 */
export const getRsvpsForEvents = async (
  db: Db,
  opts: {
    eventIds: readonly string[];
    userId: string;
  },
): Promise<Map<string, EventRsvp['status']>> => {
  if (opts.eventIds.length === 0) return new Map();

  const rows = await db
    .select({ eventId: eventRsvps.eventId, status: eventRsvps.status })
    .from(eventRsvps)
    .where(
      and(
        inArray(eventRsvps.eventId, [...opts.eventIds]),
        eq(eventRsvps.userId, opts.userId),
      ),
    );

  const map = new Map<string, EventRsvp['status']>();
  for (const row of rows) map.set(row.eventId, row.status);
  return map;
};

/**
 * Every attendee still going to an event, with the contact details a notification needs.
 *
 * Used when a host cancels: the notice has to reach the people who said yes, and each of them is
 * reached on their own channel and in their own language, so phone, email and locale preference
 * come back with the row rather than in a second query per attendee. Cancelled RSVPs are excluded
 * — someone who already withdrew should not be told the meetup they left is off.
 */
export const listGoingAttendees = async (
  db: Db,
  eventId: string,
): Promise<
  ReadonlyArray<{
    userId: string;
    email: string;
    phoneNumber: string | null;
    localePref: string | null;
  }>
> =>
  db
    .select({
      userId: eventRsvps.userId,
      email: user.email,
      phoneNumber: user.phoneNumber,
      localePref: user.localePref,
    })
    .from(eventRsvps)
    .innerJoin(user, eq(user.id, eventRsvps.userId))
    .where(
      and(eq(eventRsvps.eventId, eventId), eq(eventRsvps.status, 'going')),
    );
