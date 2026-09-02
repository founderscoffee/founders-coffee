import { and, asc, eq, lte } from 'drizzle-orm';

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
