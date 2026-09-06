import { id } from '@founders-coffee/core';
import {
  enqueueNotification,
  listGoingAttendees,
  type Db,
} from '@founders-coffee/db';

import { resolveNotificationContext } from './context.js';
import {
  valuesFor,
  validPayload,
  type NotificationPayload,
} from './producer.js';
import { emailPayloadFor, smsBodyFor } from './templates.js';

/**
 * Tell everyone still going that the host called the meetup off.
 *
 * Ordering matters and is the caller's job: the pending reminders are dropped *first* so that a
 * reminder for a meetup that is not happening can never outlive this call, and the notices are
 * enqueued after. Each attendee is reached the way they signed up to be reached — SMS with an
 * email fallback when a number is on file, email otherwise — and in their own language, which is
 * why the roster carries `localePref` rather than being resolved once for the whole event.
 *
 * Sent immediately (`sendAt` now); a cancellation has no useful later moment. The host is skipped
 * — they are an attendee of their own event since creation, and do not need to be told what they
 * just did.
 */
export const enqueueEventCancellationNotices = async (
  db: Db,
  opts: {
    eventId: string;
    hostId: string;
    eventTitle: string;
    eventSlug: string;
    marketCode: string;
    startsAt: Date;
    venue: string;
    reason?: string | null;
  },
): Promise<number> => {
  const attendees = await listGoingAttendees(db, opts.eventId);
  const templateKey = 'event_cancelled' as const;
  const reason = opts.reason ?? undefined;
  let sent = 0;

  for (const attendee of attendees) {
    if (attendee.userId === opts.hostId) continue;

    const context = await resolveNotificationContext(db, {
      preferred: attendee.localePref,
      marketCode: opts.marketCode,
    });
    const hasPhone = Boolean(attendee.phoneNumber);
    const channel: 'sms' | 'email' = hasPhone ? 'sms' : 'email';
    const basePayload: NotificationPayload = {
      phoneNumber: attendee.phoneNumber ?? undefined,
      email: attendee.email,
      eventTitle: opts.eventTitle,
      eventSlug: opts.eventSlug,
      marketCode: opts.marketCode,
      startsAt: opts.startsAt.toISOString(),
      venue: opts.venue,
      locale: context.locale,
    };
    const smsBody = smsBodyFor(
      templateKey,
      valuesFor(basePayload, context, false, reason),
      context.locale,
    );
    const emailPayload = emailPayloadFor(
      templateKey,
      valuesFor(basePayload, context, true, reason),
      context.locale,
    );

    await enqueueNotification(db, {
      id: id('ntf'),
      eventId: opts.eventId,
      userId: attendee.userId,
      channel,
      templateKey,
      payload: validPayload(
        channel,
        channel === 'sms'
          ? { ...basePayload, smsBody, ...emailPayload }
          : { ...basePayload, ...emailPayload },
      ),
      sendAt: new Date(),
      fallbackChannel: hasPhone ? 'email' : undefined,
    });
    sent += 1;
  }

  return sent;
};
