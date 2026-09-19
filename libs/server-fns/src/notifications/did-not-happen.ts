import { formatDate } from '@founders-coffee/i18n';
import {
  enqueueNotificationIfAbsent,
  getNotificationContact,
  listGoingAttendees,
  type Db,
} from '@founders-coffee/db';

import { channelPlanFor } from './channel-plan.js';
import { resolveNotificationContext } from './context.js';
import { armNotificationSchedule } from './schedule.js';
import { pushPayloadFor } from './templates.js';
import { emailPayloadFor } from './email-templates.js';
import { validPayload } from './producer.js';

export interface DidNotHappenEvent {
  readonly id: string;
  readonly hostId: string;
  readonly marketCode: string;
  readonly title: string;
  readonly venue: string;
  readonly slug: string;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
}

/**
 * One notice per member, with an id derived from the pair it is about.
 *
 * Idempotency here is not a nicety: a host who submits the closeout twice, or a correction that
 * re-runs the fan-out, must not text the same people again. Deriving the id lets the primary key
 * refuse the second write instead of a read deciding it.
 */
export const didNotHappenNoticeId = (eventId: string, userId: string): string =>
  `ntf_dnh_${eventId.replace(/^evt_/, '')}_${userId}`;

/**
 * Tell everyone who said they were coming that it did not take place.
 *
 * The frozen going set is the audience: §5.17 freezes RSVP intent at `startsAt`, so this reaches the
 * people who were expecting to be there and not whoever happens to hold an RSVP now.
 *
 * The message states what happened and asks for nothing. It must not invite feedback — there is
 * nothing to give feedback on — and must not read as a completion, because a member whose record
 * says they attended a gathering that never occurred has been told something untrue by the product.
 * The copy carries no link for the same reason: every other destination would imply there is
 * something to do.
 *
 * `pushUrl` is therefore **omitted**, not emptied. The payload schema validates it with `z.url()`,
 * which refuses an empty string, and the sweep parses every payload before dispatching — so a blank
 * one failed validation for every recipient, logged an error apiece, and reached people only through
 * the email fallback that a guaranteed push failure happened to create. Absent is a state the schema
 * has; empty is not.
 *
 * The host is skipped. They are the one who just said it did not happen.
 *
 * The channel plan selects push first with email behind it when both are enabled, or email as the
 * primary when it is the member's only selection. There is no SMS: a gathering that already failed
 * to occur is not the same-day disruption SMS survives for — the member is not about to set off.
 */
export const enqueueDidNotHappenNotices = async (
  db: Db,
  event: DidNotHappenEvent,
): Promise<number> => {
  const attendees = await listGoingAttendees(db, event.id);
  let sent = 0;

  for (const attendee of attendees) {
    if (attendee.userId === event.hostId) continue;
    const contact = await getNotificationContact(db, attendee.userId);
    if (!contact) continue;
    const plan = channelPlanFor(contact, 'event_did_not_happen');
    if (!plan) continue;

    const context = await resolveNotificationContext(db, {
      preferred: attendee.localePref,
      marketCode: event.marketCode,
    });

    const values = {
      title: event.title,
      venue: event.venue,
      date: formatDate(event.startsAt, context.locale, {
        timeZone: context.timeZone,
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
      url: '',
    };

    const { pushUrl: _discarded, ...push } = pushPayloadFor(
      'event_did_not_happen',
      values,
      context.locale,
    );
    void _discarded;

    const payload = {
      email: contact.email,
      eventTitle: event.title,
      eventSlug: event.slug,
      marketCode: event.marketCode,
      startsAt: event.startsAt.toISOString(),
      venue: event.venue,
      locale: context.locale,
      ...push,
      ...(await emailPayloadFor(
        'event_did_not_happen',
        values,
        context.locale,
      )),
    };

    const { written } = await enqueueNotificationIfAbsent(db, {
      id: didNotHappenNoticeId(event.id, attendee.userId),
      eventId: event.id,
      userId: attendee.userId,
      channel: plan.primary,
      templateKey: 'event_did_not_happen',
      payload: plan.fallback
        ? validPayload(plan.fallback, validPayload(plan.primary, payload))
        : validPayload(plan.primary, payload),
      sendAt: new Date(),
      fallbackChannel: plan.fallback ?? undefined,
    });

    if (written) sent += 1;
  }

  if (sent > 0) await armNotificationSchedule(event.id, new Date());
  return sent;
};
