import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm';

import type { Db } from './db.js';
import {
  NOTIFICATION_TEMPLATE_KEYS,
  RSVP_LIFECYCLE_TEMPLATE_KEYS,
  scheduledNotifications,
  type ScheduledNotification,
} from './schema.js';

export {
  enqueueNotification,
  enqueueNotificationIfAbsent,
  enqueueNotificationIfNoPending,
} from './notification-enqueue.js';

/**
 * List pending notifications due for delivery (`send_at <= now`), oldest first.
 *
 * The order is explicit so selection is deterministic and the partial index on `send_at` is used
 * predictably; `id` breaks ties so two rows due in the same second cannot swap places between
 * sweeps. The sweep takes a bounded window, so an undelivered row must always reach a terminal
 * state — a row that stays `pending` at an unchanged `send_at` holds a slot in that window
 * forever and eventually starves every other channel.
 */
export const listPendingNotifications = async (
  db: Db,
  opts: { limit: number; now: Date },
): Promise<ScheduledNotification[]> => {
  return db
    .select()
    .from(scheduledNotifications)
    .where(
      and(
        eq(scheduledNotifications.status, 'pending'),
        lte(scheduledNotifications.sendAt, opts.now),
      ),
    )
    .orderBy(asc(scheduledNotifications.sendAt), asc(scheduledNotifications.id))
    .limit(opts.limit);
};

/**
 * When this event's next undelivered notification is due, or `null` when it has none.
 *
 * This is what an event's Durable Object rearms against after it fires. Asking D1 rather than
 * tracking the schedule in the object's own storage is deliberate: rows arrive from more than one
 * writer — a second member RSVPs, a failed row is deferred to a later attempt, a fallback row is
 * created behind a permanent failure — and an object holding a private copy of the schedule would
 * be wrong every time one of those happened without it. The table is the schedule; the alarm is
 * only a pointer into it.
 *
 * `pending` and not `processing`: a claimed row belongs to a run that is dispatching it, and waking
 * for it would either contend or double-send. If that run dies, the claim timeout and the recovery
 * sweep are what bring the row back, not an alarm.
 */
export const nextPendingSendAt = async (
  db: Db,
  eventId: string,
): Promise<Date | null> => {
  const rows = await db
    .select({ sendAt: scheduledNotifications.sendAt })
    .from(scheduledNotifications)
    .where(
      and(
        eq(scheduledNotifications.eventId, eventId),
        eq(scheduledNotifications.status, 'pending'),
      ),
    )
    .orderBy(asc(scheduledNotifications.sendAt))
    .limit(1);
  return rows[0]?.sendAt ?? null;
};

export const getNotification = async (
  db: Db,
  id: string,
): Promise<ScheduledNotification | undefined> => {
  const rows = await db
    .select()
    .from(scheduledNotifications)
    .where(eq(scheduledNotifications.id, id))
    .limit(1);
  return rows[0];
};

/**
 * Cancel all pending notifications for an event (EC-2). `cancelled` is terminal and distinct from
 * `failed`, so an operator reading the table can tell a retired notification from one delivery
 * could not complete.
 */
export const cancelNotificationsByEvent = async (
  db: Db,
  opts: { eventId: string },
): Promise<number> => {
  const result = await db
    .update(scheduledNotifications)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(
      and(
        eq(scheduledNotifications.eventId, opts.eventId),
        eq(scheduledNotifications.status, 'pending'),
      ),
    );

  return (result.meta?.changes ?? 0) as number;
};

/** Cancel one user's pending notifications for an event (EC-1). See {@link cancelNotificationsByEvent}. */
/**
 * Withdraw the messages that existed because this member said they were coming.
 *
 * Scoped to `RSVP_LIFECYCLE_TEMPLATE_KEYS` rather than to every pending row for the pair, and the
 * distinction is not cosmetic. A host holds a `going` RSVP on their own event — `attendHostOwnEvent`
 * creates one at creation — so an unscoped cancel let a host who merely changed their mind about
 * attending silently withdraw every pending row addressed to them, including host-directed notices
 * that have nothing to do with their own attendance.
 *
 * Adding a key to that list is a statement that the message is about the recipient's own attendance.
 * A host-directed message must never be listed, however convenient it looks.
 */
export const cancelNotificationsByUserEvent = async (
  db: Db,
  opts: { eventId: string; userId: string },
): Promise<number> => {
  const result = await db
    .update(scheduledNotifications)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(
      and(
        eq(scheduledNotifications.eventId, opts.eventId),
        eq(scheduledNotifications.userId, opts.userId),
        eq(scheduledNotifications.status, 'pending'),
        inArray(scheduledNotifications.templateKey, [
          ...RSVP_LIFECYCLE_TEMPLATE_KEYS,
        ]),
      ),
    );

  return (result.meta?.changes ?? 0) as number;
};

/**
 * Check if a pending notification already exists for a user+event+template.
 * Prevents duplicate enqueues on re-RSVP.
 */
export const hasPendingNotification = async (
  db: Db,
  opts: {
    eventId: string;
    userId: string;
    templateKey: (typeof NOTIFICATION_TEMPLATE_KEYS)[number];
  },
): Promise<boolean> => {
  const rows = await db
    .select({ id: scheduledNotifications.id })
    .from(scheduledNotifications)
    .where(
      and(
        eq(scheduledNotifications.eventId, opts.eventId),
        eq(scheduledNotifications.userId, opts.userId),
        eq(scheduledNotifications.templateKey, opts.templateKey),
        eq(scheduledNotifications.status, 'pending'),
      ),
    )
    .limit(1);

  return rows.length > 0;
};

const JUSTIFICATION_SLACK_SECONDS = 5;

/**
 * Drop a host's pending "somebody is coming" notice once nobody is.
 *
 * The notice is coalesced: one pending row stands for every RSVP that arrived while it was waiting.
 * Cancelling an RSVP therefore cannot simply cancel the notice, because a second guest may be
 * relying on the same row — and it cannot be left alone either, or a host is told to expect somebody
 * who has withdrawn, opens the event and finds the list unchanged.
 *
 * The test is whether anyone is still going who joined after the notice was written. `cancelRsvp`
 * deletes the attendee row rather than marking it, and `createRsvp` inserts a fresh one, so "still
 * going" and "joined recently" are both readable from `event_rsvps` alone with no extra state.
 *
 * One statement, so the count and the withdrawal see the same snapshot; a read followed by a write
 * would let a concurrent RSVP land in between and lose its notice.
 *
 * The slack covers the gap between inserting the RSVP and enqueueing the notice, which happen in one
 * request but can straddle a second boundary. Without it a guest who joined a fraction of a second
 * before the notice was written would not count as justifying it, and a burst of two could be
 * withdrawn by one of them cancelling.
 */
export const withdrawStaleHostNotice = async (
  db: Db,
  opts: { eventId: string; hostId: string },
): Promise<number> => {
  const result = await db.run(
    sql`UPDATE scheduled_notifications
        SET status = 'cancelled', updated_at = unixepoch()
        WHERE event_id = ${opts.eventId}
          AND user_id = ${opts.hostId}
          AND template_key = 'rsvp_received'
          AND status = 'pending'
          AND NOT EXISTS (
            SELECT 1 FROM event_rsvps
            WHERE event_id = ${opts.eventId}
              AND status = 'going'
              AND created_at >= scheduled_notifications.created_at - ${JUSTIFICATION_SLACK_SECONDS}
          )`,
  );
  return (
    (result as unknown as { meta?: { changes?: number } }).meta?.changes ?? 0
  );
};
