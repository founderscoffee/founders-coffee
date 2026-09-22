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

export type EventChangeTemplateKey = 'event_rescheduled' | 'event_relocated';

/**
 * Tell everyone still going that the host changed the plan.
 *
 * One notice per save, never two. An edit that moves the start and the café at once is a single
 * change of plan from the reader's side, and `event_rescheduled` already carries both the new time
 * and the new venue, so the caller picks the one key that describes what happened rather than
 * queueing a message per field. `event_relocated` exists for the case the time notice cannot
 * honestly cover: the hour is untouched and only the place moved, where a push headed "new time"
 * would send people looking for a change that is not there.
 *
 * `startsAt` is the start as it now stands, true for either key — the relocation copy restates it
 * precisely so a reader who half-remembers the evening is not left checking. The caller re-arms the
 * reminders before calling this, so nothing queued against an older plan can land afterwards and
 * contradict it.
 *
 * Each attendee is told in their own language, which is why the roster carries `localePref` rather
 * than resolving one locale for the whole event.
 *
 * There is no SMS path here, unlike cancellation. ND-07 narrows SMS to a single case — stopping
 * somebody who is about to set off for a gathering that is not happening — and a meetup that is
 * still happening, at a different hour or a different address, is not it. Push with email beneath
 * it is the whole plan.
 *
 * Sent immediately: a changed plan has no useful later moment. The host is skipped — they hold a
 * `going` RSVP on their own event since creation, and do not need to be told what they just did.
 */
export const enqueueEventChangeNotices = async (
  db: Db,
  opts: {
    eventId: string;
    hostId: string;
    eventTitle: string;
    eventSlug: string;
    marketCode: string;
    startsAt: Date;
    venue: string;
    venueAddress: string | null;
    templateKey: EventChangeTemplateKey;
  },
): Promise<number> => {
  const attendees = await listGoingAttendees(db, opts.eventId);
  const templateKey = opts.templateKey;
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
      venueAddress: opts.venueAddress ?? undefined,
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
