import {
  id,
  type Locale,
  type NotificationDeliveryChannel,
} from '@founders-coffee/core';
import { notifications } from '@founders-coffee/domain';
import { formatDate } from '@founders-coffee/i18n';
import {
  eventUrlFor,
  resolveNotificationContext,
  type NotificationContext,
} from './context.js';
import { channelPlanFor } from './channel-plan.js';
import { armNotificationSchedule } from './schedule.js';
import { pushPayloadFor, type TemplateValues } from './templates.js';
import { emailPayloadFor } from './email-templates.js';
import {
  enqueueNotification,
  getNotificationContact,
  hasPendingNotification,
  cancelNotificationsByUserEvent,
  cancelNotificationsByEvent,
  type Db,
} from '@founders-coffee/db';

const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export interface NotificationPayload {
  phoneNumber?: string;
  email?: string;
  eventTitle: string;
  eventSlug: string;
  marketCode: string;
  startsAt: string;
  venue: string;
  locale: Locale;
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

/**
 * Refuse to persist a payload the sweep would later reject.
 *
 * The contract is enforced on both sides of the row: the producer cannot write a shape the
 * dispatcher cannot parse, so an `invalid_payload` failure can only ever mean a row older than this
 * schema or one written by something else. Throwing is right here — the caller is inside the RSVP
 * transaction path, and a malformed notification is a bug in this file, not a user error.
 */
export const validPayload = (
  channel: NotificationDeliveryChannel,
  payload: Record<string, unknown>,
): Record<string, unknown> => {
  const parsed = notifications.parseNotificationPayload(channel, payload);
  if (!parsed.ok) {
    throw new Error(
      `notification payload rejected for channel '${channel}': ${parsed.reason}`,
    );
  }
  return payload;
};

export const valuesFor = (
  payload: NotificationPayload,
  context: NotificationContext,
  withTime: boolean,
  reason?: string,
): TemplateValues => ({
  title: payload.eventTitle,
  venue: payload.venue,
  date: dateFor(payload.startsAt, context, withTime),
  url: eventUrlFor({
    marketSlug: context.marketSlug,
    eventSlug: payload.eventSlug,
  }),
  reason,
});

/**
 * Enqueue the confirmation and reminders one RSVP earns, on one channel each.
 *
 * - `rsvp_confirmation`: immediately
 * - `reminder_72h` and `reminder_24h`: only while the event is still that far away
 *
 * The channel plan selects push first with email behind it when both are enabled, or email as the
 * primary when it is the member's only selection. There is no SMS. Each reminder used to be
 * enqueued twice — once on SMS or email and once on push — so a member with a phone and a device
 * received the same reminder through two channels at the same moment. CO-02 removed that: one row
 * per reminder, and the fallback is reached the way every other fallback is, by the primary failing
 * permanently. PF-07a's guard makes
 * that path real — a member with no live device fails push permanently, which is exactly the
 * condition that writes the fallback row.
 *
 * **ND-07 changed what that fallback is.** It was SMS behind a consent almost nobody had given, and
 * email was excluded on the grounds that a reminder is not a workflow the member chose. Both halves
 * were wrong for this product. Push reaches perhaps a third of members — iOS needs the app installed,
 * a denied permission is permanent, and a subscription dies quietly when a device is signed out — so
 * something has to sit under it. Email is that floor and costs nothing per message: authentication
 * here is an email OTP, so a member without a working address cannot exist. SMS billed per message
 * for a confirmation and two reminders, to reach the same person the free channel already reaches.
 *
 * SMS is not deleted, it is narrowed. It survives for same-day disruption in `cancellation.ts`,
 * where an unread email means somebody crosses the city for a gathering that is not happening.
 * Nothing routine goes to it.
 *
 * A member with no live device and no email address receives nothing, which is now a state that
 * cannot occur through the front door — it is kept as a guard, not as a designed outcome.
 *
 * Skips if a pending notification already exists, so re-RSVPing does not duplicate anything.
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
  const contact = await getNotificationContact(db, opts.userId);
  if (!contact) return;
  const context = await resolveNotificationContext(db, {
    preferred: opts.locale,
    marketCode: opts.marketCode,
  });
  const locale = context.locale;
  const now = Date.now();
  const startsAtMs = opts.startsAt.getTime();

  const basePayload: NotificationPayload = {
    phoneNumber: opts.phoneNumber ?? undefined,
    email: contact.email,
    eventTitle: opts.eventTitle,
    eventSlug: opts.eventSlug,
    marketCode: opts.marketCode,
    startsAt: opts.startsAt.toISOString(),
    venue: opts.venue,
    locale: context.locale,
  };

  let earliest: Date | null = null;

  const enqueueNotificationFor = async (
    templateKey: 'rsvp_confirmation' | 'reminder_72h' | 'reminder_24h',
    sendAt: Date,
  ): Promise<void> => {
    const plan = channelPlanFor(contact, templateKey);
    if (!plan) return;
    if (
      await hasPendingNotification(db, {
        eventId: opts.eventId,
        userId: opts.userId,
        templateKey,
      })
    )
      return;

    const payload = {
      ...basePayload,
      ...pushPayloadFor(
        templateKey,
        valuesFor(basePayload, context, true),
        locale,
      ),
      ...(await emailPayloadFor(
        templateKey,
        valuesFor(basePayload, context, true),
        locale,
      )),
    };

    await enqueueNotification(db, {
      id: id('ntf'),
      eventId: opts.eventId,
      userId: opts.userId,
      channel: plan.primary,
      templateKey,
      payload: plan.fallback
        ? validPayload(plan.fallback, validPayload(plan.primary, payload))
        : validPayload(plan.primary, payload),
      sendAt,
      fallbackChannel: plan.fallback ?? undefined,
    });

    if (!earliest || sendAt < earliest) earliest = sendAt;
  };

  await enqueueNotificationFor('rsvp_confirmation', new Date());

  if (startsAtMs - now > SEVENTY_TWO_HOURS_MS)
    await enqueueNotificationFor(
      'reminder_72h',
      new Date(startsAtMs - SEVENTY_TWO_HOURS_MS),
    );

  if (startsAtMs - now > TWENTY_FOUR_HOURS_MS)
    await enqueueNotificationFor(
      'reminder_24h',
      new Date(startsAtMs - TWENTY_FOUR_HOURS_MS),
    );

  if (earliest) await armNotificationSchedule(opts.eventId, earliest);
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
