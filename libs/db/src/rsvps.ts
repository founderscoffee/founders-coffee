import { and, eq, inArray, sql } from 'drizzle-orm';

import { batch } from './atomic.js';
import type { Db } from './db.js';
import { eventRsvps, events, type EventRsvp } from './schema.js';

export type CreateRsvpOutcome = 'created' | 'event_full' | 'already_rsvpd';

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

const hasCapacity = (eventId: string) =>
  sql`id = ${eventId} AND (capacity = 0 OR rsvps < capacity)`;

/**
 * Create an RSVP, writing nothing at all when the event is full (AGENTS.md §11 — atomic
 * single-statement SQL, never read-then-write).
 *
 * The insert selects its row *from* `events` under the capacity predicate, so it produces one row
 * when a seat is free and none when it is not. Its value list must line up with the column list
 * Drizzle generates from the schema, which `RSVP_INSERT_COLUMNS` pins by test — a column added to
 * `event_rsvps` would otherwise widen that list and break the insert at runtime only. It is written first on purpose: it must read `rsvps`
 * before the counter moves, or the final seat would increment the counter while inserting no
 * attendee. The counter update carries the same predicate and runs in the same D1 batch, so both
 * observe one snapshot of `events` and either both apply or neither does.
 *
 * `capacity = 0` means unlimited, so the predicate short-circuits.
 *
 * Concurrency: D1 serializes the batches, so a race for the last seat lets exactly one through —
 * the loser's select finds no qualifying event row. A concurrent duplicate by the same user
 * violates `UNIQUE(event_id, user_id)`, which rolls the whole batch back and surfaces here as
 * `already_rsvpd` rather than an untyped throw (AGENTS.md §16).
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
            FROM events WHERE ${hasCapacity(opts.eventId)}`,
      ),
      db
        .update(events)
        .set({ rsvps: sql`rsvps + 1` })
        .where(hasCapacity(opts.eventId)),
    ]);

    const insertResult = results[0] as { meta?: { changes?: number } };
    const inserted = insertResult.meta?.changes ?? 0;
    return { outcome: inserted === 1 ? 'created' : 'event_full' };
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
        sql`id = ${opts.eventId} AND rsvps > 0 AND EXISTS (
              SELECT 1 FROM event_rsvps
              WHERE event_id = ${opts.eventId} AND user_id = ${opts.userId}
            )`,
      ),
    db
      .delete(eventRsvps)
      .where(
        and(
          eq(eventRsvps.eventId, opts.eventId),
          eq(eventRsvps.userId, opts.userId),
        ),
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
