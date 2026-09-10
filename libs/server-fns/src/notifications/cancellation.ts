import { id } from '@founders-coffee/core';
import {
  enqueueNotification,
  getNotificationContact,
  listGoingAttendees,
  type Db,
} from '@founders-coffee/db';

import { resolveNotificationContext } from './context.js';
import {
  valuesFor,
  validPayload,
  type NotificationPayload,
} from './producer.js';
import { armNotificationSchedule } from './schedule.js';
import { emailPayloadFor, pushPayloadFor, smsBodyFor } from './templates.js';

const SAME_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether this cancellation is close enough to the start to be worth a text message.
 *
 * ND-07 keeps SMS for exactly one thing: telling somebody not to set off. A cancellation a week out
 * is news, and email carries news; a cancellation two hours out is the difference between reading it
 * and crossing Algiers for a gathering that is not happening. The window is what separates the two,
 * and it is the only place left in the product that bills per message.
 */
export const isSameDay = (startsAt: Date, now = Date.now()): boolean =>
  startsAt.getTime() - now <= SAME_DAY_MS;

/**
 * Tell everyone still going that the host called the meetup off.
 *
 * Ordering matters and is the caller's job: the pending reminders are dropped *first* so that a
 * reminder for a meetup that is not happening can never outlive this call, and the notices are
 * enqueued after. Each attendee is told in their own language, which is why the roster carries
 * `localePref` rather than resolving one locale for the whole event.
 *
 * One row per attendee, on push, exactly like the RSVP path (CO-02). The fallback behind it is SMS
 * for an attendee who has consented to it on a verified number, and email for everyone else. Email survives here and nowhere
 * else in the event lane: a reminder that never arrives costs someone a calendar entry, while an
 * unheard cancellation sends them to a café for a meetup that is not happening, so this is the one
 * event notice worth reaching a member who has neither a live device nor a phone on file.
 *
 * A fallback row inherits this payload unchanged, so it carries whichever content its own fallback
 * channel requires and is validated against both channels before it is written.
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
    const contact = await getNotificationContact(db, attendee.userId);
    const hasPhone = Boolean(
      attendee.phoneNumber &&
      contact?.phoneNumberVerified &&
      contact.smsFallbackEnabled,
    );
    const channel = 'push' as const;
    const fallback: 'sms' | 'email' =
      hasPhone && isSameDay(opts.startsAt) ? 'sms' : 'email';
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
    const pushPayload = pushPayloadFor(
      templateKey,
      valuesFor(basePayload, context, true, reason),
      context.locale,
    );
    const payload =
      fallback === 'sms'
        ? { ...basePayload, ...pushPayload, smsBody }
        : {
            ...basePayload,
            ...pushPayload,
            ...emailPayloadFor(
              templateKey,
              valuesFor(basePayload, context, true, reason),
              context.locale,
            ),
          };

    await enqueueNotification(db, {
      id: id('ntf'),
      eventId: opts.eventId,
      userId: attendee.userId,
      channel,
      templateKey,
      payload: validPayload(fallback, validPayload(channel, payload)),
      sendAt: new Date(),
      fallbackChannel: fallback,
    });
    sent += 1;
  }

  if (sent > 0) await armNotificationSchedule(opts.eventId, new Date());

  return sent;
};
