import { and, eq, inArray, sql } from 'drizzle-orm';

import { batch } from './atomic.js';
import type { Db } from './db.js';
import { eventRsvps, events, type EventRsvp } from './schema.js';

/**
 * Create an RSVP for an event. Atomic capacity check via D1 batch (AGENTS.md §11):
 *   1. UPDATE events SET rsvps = rsvps + 1 WHERE id = ? AND (capacity = 0 OR rsvps < capacity)
 *   2. INSERT INTO event_rsvps (id, event_id, user_id, status)
 *
 * `capacity = 0` means unlimited (the WHERE clause skips the capacity gate).
 *
 * D1 batch is atomic: if the INSERT violates UNIQUE(event_id, user_id), the entire
 * batch rolls back — the counter UPDATE is undone. The caller catches the UNIQUE
 * violation and maps it to `already_rsvpd`.
 *
 * If the UPDATE affects 0 rows (event is full), the batch still succeeds but the
 * counter was not incremented. The caller checks the UPDATE result to detect
 * `event_full`.
 */
export const createRsvp = async (
  db: Db,
  opts: {
    id: string;
    eventId: string;
    userId: string;
  },
): Promise<{ status: 'going'; eventFull: boolean }> => {
  const rsvpRow = {
    id: opts.id,
    eventId: opts.eventId,
    userId: opts.userId,
    status: 'going' as const,
  };

  const results = await batch(db, [
    db
      .update(events)
      .set({ rsvps: sql`rsvps + 1` })
      .where(
        and(
          eq(events.id, opts.eventId),
          sql`(${events.capacity} = 0 OR ${events.rsvps} < ${events.capacity})`,
        ),
      ),
    db.insert(eventRsvps).values(rsvpRow),
  ]);

  const updateResult = results[0] as { meta?: { changes?: number } };
  const eventFull = (updateResult.meta?.changes ?? 0) === 0;

  return { status: 'going', eventFull };
};

/**
 * Cancel (hard-delete) an RSVP and decrement the denormalized counter. The decrement is gated on
 * the DELETE actually removing a row — two concurrent cancels by the same user can't drive the
 * counter negative (the second DELETE affects 0 rows → no decrement). The `rsvps > 0` guard is a
 * belt-and-suspenders against any drift. Not a single batch (D1 batch can't conditionally skip a
 * statement); correctness over a false atomicity that drifted the counter.
 */
export const cancelRsvp = async (
  db: Db,
  opts: {
    eventId: string;
    userId: string;
  },
): Promise<{ deleted: boolean }> => {
  const result = (await db
    .delete(eventRsvps)
    .where(
      and(
        eq(eventRsvps.eventId, opts.eventId),
        eq(eventRsvps.userId, opts.userId),
      ),
    )) as { meta?: { changes?: number } };

  if ((result.meta?.changes ?? 0) === 0) return { deleted: false };

  await db
    .update(events)
    .set({ rsvps: sql`rsvps - 1` })
    .where(and(eq(events.id, opts.eventId), sql`${events.rsvps} > 0`));

  return { deleted: true };
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
