import { id } from '@founders-coffee/core';
import { formatDate } from '@founders-coffee/i18n';
import {
  eventUrlFor,
  resolveNotificationContext,
  type NotificationContext,
} from './context.js';
import {
  emailPayloadFor,
  pushPayloadFor,
  smsBodyFor,
  type TemplateValues,
} from './templates.js';
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

const dateFor = (
  startsAt: string,
  context: NotificationContext,
  withTime: boolean,
): string =>
  formatDate(new Date(startsAt), context.locale, {
    timeZone: context.timeZone,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    ...(withTime
      ? { hour: '2-digit' as const, minute: '2-digit' as const }
      : {}),
  });

const valuesFor = (
  payload: NotificationPayload,
  context: NotificationContext,
  withTime: boolean,
): TemplateValues => ({
  title: payload.eventTitle,
  venue: payload.venue,
  date: dateFor(payload.startsAt, context, withTime),
  url: eventUrlFor({
    marketCode: payload.marketCode,
    eventSlug: payload.eventSlug,
  }),
});

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
    locale?: string | null;
  },
): Promise<void> => {
  const context = await resolveNotificationContext(db, {
    preferred: opts.locale,
    marketCode: opts.marketCode,
  });
  const locale = context.locale;
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
    locale: context.locale,
  };

  const confirmKey = 'rsvp_confirmation' as const;
  if (
    !(await hasPendingNotification(db, {
      eventId: opts.eventId,
      userId: opts.userId,
      templateKey: confirmKey,
    }))
  ) {
    const smsBody = smsBodyFor(
      confirmKey,
      valuesFor(basePayload, context, false),
      locale,
    );
    const emailPayload = emailPayloadFor(
      confirmKey,
      valuesFor(basePayload, context, true),
      locale,
    );
    await enqueueNotification(db, {
      id: id('ntf'),
      eventId: opts.eventId,
      userId: opts.userId,
      channel,
      templateKey: confirmKey,
      payload:
        channel === 'sms'
          ? { ...basePayload, smsBody }
          : { ...basePayload, ...emailPayload },
      sendAt: new Date(),
      fallbackChannel: fallback,
    });
  }

  if (startsAtMs - now > SEVEN_DAYS_MS) {
    const reminder72Key = 'reminder_72h' as const;
    if (
      !(await hasPendingNotification(db, {
        eventId: opts.eventId,
        userId: opts.userId,
        templateKey: reminder72Key,
      }))
    ) {
      const smsBody = smsBodyFor(
        reminder72Key,
        valuesFor(basePayload, context, false),
        locale,
      );
      const emailPayload = emailPayloadFor(
        reminder72Key,
        valuesFor(basePayload, context, true),
        locale,
      );
      await enqueueNotification(db, {
        id: id('ntf'),
        eventId: opts.eventId,
        userId: opts.userId,
        channel,
        templateKey: reminder72Key,
        payload:
          channel === 'sms'
            ? { ...basePayload, smsBody }
            : { ...basePayload, ...emailPayload },
        sendAt: new Date(startsAtMs - SEVEN_DAYS_MS),
        fallbackChannel: fallback,
      });
      const pushPayload72 = pushPayloadFor(
        reminder72Key,
        valuesFor(basePayload, context, true),
        locale,
      );
      await enqueueNotification(db, {
        id: id('ntf'),
        eventId: opts.eventId,
        userId: opts.userId,
        channel: 'push',
        templateKey: reminder72Key,
        payload: { ...basePayload, ...pushPayload72 },
        sendAt: new Date(startsAtMs - SEVEN_DAYS_MS),
      });
    }
  }

  if (startsAtMs - now > TWENTY_FOUR_HOURS_MS) {
    const reminder24Key = 'reminder_24h' as const;
    if (
      !(await hasPendingNotification(db, {
        eventId: opts.eventId,
        userId: opts.userId,
        templateKey: reminder24Key,
      }))
    ) {
      const smsBody = smsBodyFor(
        reminder24Key,
        valuesFor(basePayload, context, false),
        locale,
      );
      const emailPayload = emailPayloadFor(
        reminder24Key,
        valuesFor(basePayload, context, true),
        locale,
      );
      await enqueueNotification(db, {
        id: id('ntf'),
        eventId: opts.eventId,
        userId: opts.userId,
        channel,
        templateKey: reminder24Key,
        payload:
          channel === 'sms'
            ? { ...basePayload, smsBody }
            : { ...basePayload, ...emailPayload },
        sendAt: new Date(startsAtMs - TWENTY_FOUR_HOURS_MS),
        fallbackChannel: fallback,
      });
      const pushPayload24 = pushPayloadFor(
        reminder24Key,
        valuesFor(basePayload, context, true),
        locale,
      );
      await enqueueNotification(db, {
        id: id('ntf'),
        eventId: opts.eventId,
        userId: opts.userId,
        channel: 'push',
        templateKey: reminder24Key,
        payload: { ...basePayload, ...pushPayload24 },
        sendAt: new Date(startsAtMs - TWENTY_FOUR_HOURS_MS),
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
