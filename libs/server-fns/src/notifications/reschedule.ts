import { id } from '@founders-coffee/core';
import {
  enqueueNotification,
  getNotificationContact,
  listGoingAttendees,
  type Db,
} from '@founders-coffee/db';

import { channelPlanFor } from './channel-plan.js';
import { resolveNotificationContext } from './context.js';
import {
  valuesFor,
  validPayload,
  type NotificationPayload,
} from './producer.js';
import { armNotificationSchedule } from './schedule.js';
import { pushPayloadFor } from './templates.js';
import { emailPayloadFor } from './email-templates.js';

/**
 * Tell everyone still going that the host moved the meetup.
 *
 * `startsAt` is the *new* start: the notice exists to replace a time in somebody's head, so it has
 * to carry the one that is now true rather than the one they already had. The caller re-arms the
 * reminders before calling this, so nothing queued against the old start can land afterwards and
 * contradict it.
 *
 * Each attendee is told in their own language, which is why the roster carries `localePref` rather
 * than resolving one locale for the whole event.
 *
 * There is no SMS path here, unlike cancellation. ND-07 narrows SMS to a single case — stopping
 * somebody who is about to set off for a gathering that is not happening — and a meetup that is
 * still happening, at a different hour, is not it. Push with email beneath it is the whole plan.
 *
 * Sent immediately: a time change has no useful later moment. The host is skipped — they hold a
 * `going` RSVP on their own event since creation, and do not need to be told what they just did.
 */
export const enqueueEventRescheduleNotices = async (
  db: Db,
  opts: {
    eventId: string;
    hostId: string;
    eventTitle: string;
    eventSlug: string;
    marketCode: string;
    startsAt: Date;
    venue: string;
  },
): Promise<number> => {
  const attendees = await listGoingAttendees(db, opts.eventId);
  const templateKey = 'event_rescheduled' as const;
  let sent = 0;

  for (const attendee of attendees) {
    if (attendee.userId === opts.hostId) continue;
    const contact = await getNotificationContact(db, attendee.userId);
    if (!contact) continue;
    const plan = channelPlanFor(contact, templateKey);
    if (!plan) continue;

    const context = await resolveNotificationContext(db, {
      preferred: contact.localePref,
      marketCode: opts.marketCode,
    });
    const fallback = plan.fallback ?? undefined;
    const basePayload: NotificationPayload = {
      phoneNumber: contact.phoneNumber ?? undefined,
      email: contact.email,
      eventTitle: opts.eventTitle,
      eventSlug: opts.eventSlug,
      marketCode: opts.marketCode,
      startsAt: opts.startsAt.toISOString(),
      venue: opts.venue,
      locale: context.locale,
    };
    const values = valuesFor(basePayload, context, true);
    const payload = {
      ...basePayload,
      ...pushPayloadFor(templateKey, values, context.locale),
      ...(plan.primary === 'email' || fallback === 'email'
        ? { ...(await emailPayloadFor(templateKey, values, context.locale)) }
        : {}),
    };

    await enqueueNotification(db, {
      id: id('ntf'),
      eventId: opts.eventId,
      userId: attendee.userId,
      channel: plan.primary,
      templateKey,
      payload: fallback
        ? validPayload(fallback, validPayload(plan.primary, payload))
        : validPayload(plan.primary, payload),
      sendAt: new Date(),
      fallbackChannel: fallback,
    });
    sent += 1;
  }

  if (sent > 0) await armNotificationSchedule(opts.eventId, new Date());

  return sent;
};
