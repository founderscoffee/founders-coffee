import { sql } from 'drizzle-orm';

import type {
  NotificationDeliveryChannel,
  NotificationFallbackChannel,
  NotificationTemplateKey,
} from '@founders-coffee/core';

import type { Db } from './db.js';
import {
  scheduledNotifications,
  type NewScheduledNotification,
  type ScheduledNotification,
} from './schema.js';

export type NotificationEnqueueOptions = {
  id: string;
  eventId: string;
  userId: string;
  channel: NotificationDeliveryChannel;
  templateKey: NotificationTemplateKey;
  payload: Record<string, unknown>;
  sendAt: Date;
  fallbackChannel?: NotificationFallbackChannel;
};

/**
 * Enqueue a notification for later delivery.
 */
export const enqueueNotification = async (
  db: Db,
  opts: NotificationEnqueueOptions,
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
 * Enqueue this notification unless its id is already taken.
 */
export const enqueueNotificationIfAbsent = async (
  db: Db,
  opts: NotificationEnqueueOptions,
): Promise<{ written: boolean }> => {
  const result = await db
    .insert(scheduledNotifications)
    .values({
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
    })
    .onConflictDoNothing({ target: scheduledNotifications.id });

  return { written: ((result.meta?.changes ?? 0) as number) > 0 };
};

/**
 * Enqueue one coalesced notification while a matching pending row does not exist.
 *
 * The existence check and insert are one D1 statement. A read followed by a write lets concurrent
 * RSVP requests both observe an empty window and both notify the host.
 */
export const enqueueNotificationIfNoPending = async (
  db: Db,
  opts: NotificationEnqueueOptions,
): Promise<{ written: boolean }> => {
  const result = await db.run(
    sql`INSERT INTO scheduled_notifications
        (id, event_id, user_id, channel, status, template_key, payload, send_at, attempts,
         fallback_channel, created_at, updated_at)
        SELECT ${opts.id}, ${opts.eventId}, ${opts.userId}, ${opts.channel}, 'pending',
          ${opts.templateKey}, ${JSON.stringify(opts.payload)},
          ${Math.floor(opts.sendAt.getTime() / 1000)}, 0,
          ${opts.fallbackChannel ?? null}, unixepoch(), unixepoch()
        WHERE NOT EXISTS (
          SELECT 1 FROM scheduled_notifications
          WHERE event_id = ${opts.eventId}
            AND user_id = ${opts.userId}
            AND template_key = ${opts.templateKey}
            AND status = 'pending'
        )`,
  );
  return {
    written:
      ((result as unknown as { meta?: { changes?: number } }).meta?.changes ??
        0) > 0,
  };
};
