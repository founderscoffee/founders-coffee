import { and, asc, eq, lte, sql } from 'drizzle-orm';

import { batch } from './atomic.js';
import type { Db } from './db.js';
import {
  NOTIFICATION_CHANNELS,
  scheduledNotifications,
  type NewScheduledNotification,
  type ScheduledNotification,
} from './schema.js';

/**
 * Enqueue a notification for later delivery. The producer (server-fn) calls this
 * after a successful RSVP or event creation. The Cron sweep (worker-jobs) picks
 * it up when `send_at <= now`.
 *
 * Returns the inserted row so the caller can inspect if needed.
 */
export const enqueueNotification = async (
  db: Db,
  opts: {
    id: string;
    eventId: string;
    userId: string;
    channel: (typeof NOTIFICATION_CHANNELS)[number];
    templateKey: 'rsvp_confirmation' | 'reminder_72h' | 'reminder_24h';
    payload: Record<string, unknown>;
    sendAt: Date;
    fallbackChannel?: 'email';
  },
): Promise<ScheduledNotification> => {
  const row: NewScheduledNotification = {
    id: opts.id,
    eventId: opts.eventId,
    userId: opts.userId,
    channel: opts.channel,
    status: 'pending',
    templateKey: opts.templateKey,
    payload: opts.payload,
    sendAt: opts.sendAt,
    attempts: 0,
    fallbackChannel: opts.fallbackChannel ?? null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(scheduledNotifications).values(row);

  return { ...row, status: 'pending' } as ScheduledNotification;
};

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
 * Mark a notification as sent (dispatched to provider successfully).
 */
export const markNotificationSent = async (
  db: Db,
  opts: { id: string },
): Promise<void> => {
  await db
    .update(scheduledNotifications)
    .set({ status: 'sent', updatedAt: new Date() })
    .where(eq(scheduledNotifications.id, opts.id));
};

export const NOTIFICATION_MAX_ATTEMPTS = 3;

export const NOTIFICATION_RETRY_BACKOFF_SECONDS = [60, 300] as const;

export const NOTIFICATION_INSERT_COLUMNS = [
  'id',
  'event_id',
  'user_id',
  'channel',
  'status',
  'template_key',
  'payload',
  'send_at',
  'attempts',
  'last_error',
  'fallback_channel',
  'fallback_of',
  'created_at',
  'updated_at',
] as const;

export interface NotificationFailure {
  readonly status: 'pending' | 'failed' | 'unknown';
  readonly attempts: number;
  readonly fallbackCreated: boolean;
}

/**
 * Record a delivery failure, deciding retry versus terminal failure inside the statement rather
 * than around it (AGENTS.md §11).
 *
 * While the attempt budget holds and the error is retryable, `attempts` is incremented, the error
 * recorded, `send_at` deferred by the backoff, and the row left `pending` so the next sweep picks
 * it up. When the budget is exhausted — or the provider reported a permanent error — the row goes
 * terminally `failed` and its fallback row, if it has a `fallback_channel`, is created in the same
 * batch. That is the only moment a fallback is created, which is what makes the documented
 * SMS-to-email fallback reachable at all.
 *
 * Exactly-once is a database invariant, not a timing argument: `fallback_of` is UNIQUE, so a
 * repeated failure path cannot spawn a second fallback for the same parent even if the update is
 * replayed. The update is additionally guarded on `status = 'pending'`, so a row already resolved
 * by a concurrent sweep is left alone, and the returned `status` is `unknown`.
 *
 * `NOTIFICATION_RETRY_BACKOFF_SECONDS` is deliberately short — reminders are time-bound, and a
 * 72-hour reminder delivered a day late is noise. `NOTIFICATION_INSERT_COLUMNS` pins the column
 * list Drizzle generates from the schema for the fallback insert below; a new column on the table
 * would widen that list and break this insert at runtime only, so a test asserts the two agree.
 */
export const markNotificationFailed = async (
  db: Db,
  opts: {
    id: string;
    error: string;
    permanent: boolean;
    fallbackId: string;
    now: Date;
  },
): Promise<NotificationFailure> => {
  const nowSeconds = Math.floor(opts.now.getTime() / 1000);
  const isTerminal = sql`(${opts.permanent ? 1 : 0} = 1 OR attempts + 1 >= ${NOTIFICATION_MAX_ATTEMPTS})`;
  const backoffSeconds = sql`CASE WHEN attempts + 1 <= 1 THEN ${NOTIFICATION_RETRY_BACKOFF_SECONDS[0]} ELSE ${NOTIFICATION_RETRY_BACKOFF_SECONDS[1]} END`;

  const results = await batch(db, [
    db
      .update(scheduledNotifications)
      .set({
        attempts: sql`attempts + 1`,
        lastError: opts.error,
        status: sql`CASE WHEN ${isTerminal} THEN 'failed' ELSE 'pending' END`,
        sendAt: sql`CASE WHEN ${isTerminal} THEN send_at ELSE ${nowSeconds} + ${backoffSeconds} END`,
        updatedAt: sql`${nowSeconds}`,
      })
      .where(
        and(
          eq(scheduledNotifications.id, opts.id),
          eq(scheduledNotifications.status, 'pending'),
        ),
      ),
    db
      .insert(scheduledNotifications)
      .select(
        sql`SELECT ${opts.fallbackId}, event_id, user_id, fallback_channel, 'pending', template_key,
                   payload, ${nowSeconds}, 0, NULL, NULL, id, ${nowSeconds}, ${nowSeconds}
            FROM scheduled_notifications
            WHERE id = ${opts.id}
              AND status = 'failed'
              AND fallback_channel IS NOT NULL`,
      )
      .onConflictDoNothing(),
  ]);

  const updated = (results[0] as { meta?: { changes?: number } }).meta?.changes;
  const inserted = (results[1] as { meta?: { changes?: number } }).meta
    ?.changes;
  const row = await getNotification(db, opts.id);

  return {
    status:
      (updated ?? 0) === 0
        ? 'unknown'
        : (row?.status ?? 'unknown') === 'failed'
          ? 'failed'
          : 'pending',
    attempts: row?.attempts ?? 0,
    fallbackCreated: (inserted ?? 0) > 0,
  };
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
    templateKey: 'rsvp_confirmation' | 'reminder_72h' | 'reminder_24h';
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
