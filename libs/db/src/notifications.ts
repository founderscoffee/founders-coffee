import { and, eq, lte } from 'drizzle-orm';

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
 * List pending notifications due for delivery (send_at <= now).
 * The Cron sweep calls this every minute with a LIMIT to avoid
 * processing the entire table in one pass.
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
    .limit(opts.limit);
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

/**
 * Mark a notification as failed with error details. If `canFallback` is true
 * and `fallbackChannel` is set, creates a new pending notification on the
 * fallback channel. Returns the fallback notification id if created.
 */
export const markNotificationFailed = async (
  db: Db,
  opts: {
    id: string;
    error: string;
    canFallback: boolean;
  },
): Promise<{ fallbackId?: string }> => {
  const row = await db
    .select()
    .from(scheduledNotifications)
    .where(eq(scheduledNotifications.id, opts.id))
    .limit(1);

  if (row.length === 0) return {};

  const existing = row[0];
  const newAttempts = existing.attempts + 1;

  await db
    .update(scheduledNotifications)
    .set({
      status: 'failed',
      attempts: newAttempts,
      lastError: opts.error,
      updatedAt: new Date(),
    })
    .where(eq(scheduledNotifications.id, opts.id));

  if (opts.canFallback && existing.fallbackChannel && newAttempts >= 3) {
    const fallbackId = `${existing.id}_fb`;
    await db.insert(scheduledNotifications).values({
      id: fallbackId,
      eventId: existing.eventId,
      userId: existing.userId,
      channel: existing.fallbackChannel,
      status: 'pending',
      templateKey: existing.templateKey,
      payload: existing.payload,
      sendAt: new Date(),
      attempts: 0,
      fallbackChannel: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { fallbackId };
  }

  return {};
};

/**
 * Cancel all pending notifications for an event. Called when an event is
 * cancelled or when a user cancels their RSVP (EC-1, EC-2).
 */
export const cancelNotificationsByEvent = async (
  db: Db,
  opts: { eventId: string },
): Promise<number> => {
  const result = await db
    .update(scheduledNotifications)
    .set({ status: 'failed', updatedAt: new Date() })
    .where(
      and(
        eq(scheduledNotifications.eventId, opts.eventId),
        eq(scheduledNotifications.status, 'pending'),
      ),
    );

  return (result.meta?.changes ?? 0) as number;
};

/**
 * Cancel a specific user's pending notifications for an event.
 * Called when a user cancels their RSVP (EC-1).
 */
export const cancelNotificationsByUserEvent = async (
  db: Db,
  opts: { eventId: string; userId: string },
): Promise<number> => {
  const result = await db
    .update(scheduledNotifications)
    .set({ status: 'failed', updatedAt: new Date() })
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
