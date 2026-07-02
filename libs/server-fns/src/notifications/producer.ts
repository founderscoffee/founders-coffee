/**
 * Notification producer — builds payloads and enqueues rows into
 * `scheduled_notifications`. Called from server-fns after successful
 * RSVP or event creation (AGENTS.md §7: server functions are the
 * throw boundary, domain logic in libs/domain).
 *
 * Three notification types:
 * - `rsvp_confirmation`: immediate (send_at = now)
 * - `reminder_72h`: three days before event (send_at = startsAt - 72h)
 * - `reminder_24h`: twenty-four hours before event (send_at = startsAt - 24h)
 */

import { id } from '@founders-coffee/core';
import {
  enqueueNotification,
  hasPendingNotification,
  cancelNotificationsByUserEvent,
  cancelNotificationsByEvent,
  type Db,
} from '@founders-coffee/db';

const SEVEN_DAYS_MS = 72 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export interface NotificationPayload {
  phoneNumber?: string;
  email?: string;
  eventTitle: string;
  eventSlug: string;
  marketCode: string;
  startsAt: string;
  venue: string;
  locale: string;
  rsvpCount?: number;
  capacity?: number;
}

const buildSmsBody = (
  templateKey: 'rsvp_confirmation' | 'reminder_72h' | 'reminder_24h',
  payload: NotificationPayload,
): string => {
  const eventUrl = `https://founders.coffee/${payload.marketCode}/e/${payload.eventSlug}`;
  const dateStr = new Date(payload.startsAt).toLocaleDateString(
    payload.locale === 'ar' ? 'ar-DZ' : payload.locale === 'fr' ? 'fr-DZ' : 'en',
    { weekday: 'long', month: 'short', day: 'numeric' },
  );

  switch (templateKey) {
    case 'rsvp_confirmation':
      return `You're in! ${payload.eventTitle} — ${dateStr} at ${payload.venue}. See you there! ${eventUrl}`;
    case 'reminder_72h':
      return `${payload.eventTitle} is in 3 days (${dateStr}). Don't forget! ${eventUrl}`;
    case 'reminder_24h':
      return `Tomorrow: ${payload.eventTitle} at ${payload.venue}. See you at ${dateStr}! ${eventUrl}`;
  }
};

const buildEmailPayload = (
  templateKey: 'rsvp_confirmation' | 'reminder_72h' | 'reminder_24h',
  payload: NotificationPayload,
): { subject: string; html: string; text: string } => {
  const eventUrl = `https://founders.coffee/${payload.marketCode}/e/${payload.eventSlug}`;
  const dateStr = new Date(payload.startsAt).toLocaleDateString(
    payload.locale === 'ar' ? 'ar-DZ' : payload.locale === 'fr' ? 'fr-DZ' : 'en',
    { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
  );

  switch (templateKey) {
    case 'rsvp_confirmation':
      return {
        subject: `You're in! ${payload.eventTitle}`,
        html: `<p>You're confirmed for <strong>${payload.eventTitle}</strong> on ${dateStr} at ${payload.venue}.</p><p><a href="${eventUrl}">View event</a></p>`,
        text: `You're confirmed for ${payload.eventTitle} on ${dateStr} at ${payload.venue}. ${eventUrl}`,
      };
    case 'reminder_72h':
      return {
        subject: `Reminder: ${payload.eventTitle} in 3 days`,
        html: `<p><strong>${payload.eventTitle}</strong> is in 3 days on ${dateStr}.</p><p><a href="${eventUrl}">View event</a></p>`,
        text: `${payload.eventTitle} is in 3 days on ${dateStr}. ${eventUrl}`,
      };
    case 'reminder_24h':
      return {
        subject: `Tomorrow: ${payload.eventTitle}`,
        html: `<p>Don't forget! <strong>${payload.eventTitle}</strong> is tomorrow at ${payload.venue}.</p><p><a href="${eventUrl}">View event</a></p>`,
        text: `Don't forget! ${payload.eventTitle} is tomorrow at ${payload.venue}. ${eventUrl}`,
      };
  }
};

/**
 * Enqueue RSVP confirmation + reminder notifications for a new RSVP.
 *
 * - `rsvp_confirmation`: immediate (send_at = now)
 * - `reminder_72h`: only if event is >72h away
 * - `reminder_24h`: only if event is >24h away
 *
 * Skips if a pending notification already exists (EC-4: re-RSVP idempotency).
 * SMS with email fallback for users with phone numbers; email-only otherwise (EC-3).
 */
export const enqueueRsvpNotifications = async (
  db: Db,
  opts: {
    eventId: string;
    userId: string;
    eventTitle: string;
    eventSlug: string;
    marketCode: string;
    startsAt: Date;
    venue: string;
    phoneNumber?: string | null;
    email?: string;
    locale: string;
  },
): Promise<void> => {
  const now = Date.now();
  const startsAtMs = opts.startsAt.getTime();
  const hasPhone = Boolean(opts.phoneNumber);
  const channel: 'sms' | 'email' = hasPhone ? 'sms' : 'email';
  const fallback: 'email' | undefined = hasPhone ? 'email' : undefined;

  const basePayload: NotificationPayload = {
    phoneNumber: opts.phoneNumber ?? undefined,
    email: opts.email,
    eventTitle: opts.eventTitle,
    eventSlug: opts.eventSlug,
    marketCode: opts.marketCode,
    startsAt: opts.startsAt.toISOString(),
    venue: opts.venue,
    locale: opts.locale,
  };

  /** RSVP confirmation — immediate. */
  const confirmKey = 'rsvp_confirmation' as const;
  if (!(await hasPendingNotification(db, { eventId: opts.eventId, userId: opts.userId, templateKey: confirmKey }))) {
    const smsBody = buildSmsBody(confirmKey, basePayload);
    const emailPayload = buildEmailPayload(confirmKey, basePayload);
    await enqueueNotification(db, {
      id: id('ntf'),
      eventId: opts.eventId,
      userId: opts.userId,
      channel,
      templateKey: confirmKey,
      payload: channel === 'sms'
        ? { ...basePayload, smsBody }
        : { ...basePayload, ...emailPayload },
      sendAt: new Date(),
      fallbackChannel: fallback,
    });
  }

  /** T-72h reminder — only if event is >72h away. */
  if (startsAtMs - now > SEVEN_DAYS_MS) {
    const reminder72Key = 'reminder_72h' as const;
    if (!(await hasPendingNotification(db, { eventId: opts.eventId, userId: opts.userId, templateKey: reminder72Key }))) {
      const smsBody = buildSmsBody(reminder72Key, basePayload);
      const emailPayload = buildEmailPayload(reminder72Key, basePayload);
      await enqueueNotification(db, {
        id: id('ntf'),
        eventId: opts.eventId,
        userId: opts.userId,
        channel,
        templateKey: reminder72Key,
        payload: channel === 'sms'
          ? { ...basePayload, smsBody }
          : { ...basePayload, ...emailPayload },
        sendAt: new Date(startsAtMs - SEVEN_DAYS_MS),
        fallbackChannel: fallback,
      });
    }
  }

  /** T-24h reminder — only if event is >24h away. */
  if (startsAtMs - now > TWENTY_FOUR_HOURS_MS) {
    const reminder24Key = 'reminder_24h' as const;
    if (!(await hasPendingNotification(db, { eventId: opts.eventId, userId: opts.userId, templateKey: reminder24Key }))) {
      const smsBody = buildSmsBody(reminder24Key, basePayload);
      const emailPayload = buildEmailPayload(reminder24Key, basePayload);
      await enqueueNotification(db, {
        id: id('ntf'),
        eventId: opts.eventId,
        userId: opts.userId,
        channel,
        templateKey: reminder24Key,
        payload: channel === 'sms'
          ? { ...basePayload, smsBody }
          : { ...basePayload, ...emailPayload },
        sendAt: new Date(startsAtMs - TWENTY_FOUR_HOURS_MS),
        fallbackChannel: fallback,
      });
    }
  }
};

/**
 * Cancel all pending notifications for a user's RSVP (EC-1).
 * Called when a user cancels their RSVP.
 */
export const cancelRsvpNotifications = async (
  db: Db,
  opts: { eventId: string; userId: string },
): Promise<void> => {
  await cancelNotificationsByUserEvent(db, opts);
};

/**
 * Cancel all pending notifications for an event (EC-2).
 * Called when a host cancels an event.
 */
export const cancelEventNotifications = async (
  db: Db,
  opts: { eventId: string },
): Promise<void> => {
  await cancelNotificationsByEvent(db, opts);
};
