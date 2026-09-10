import { id } from '@founders-coffee/core';
import { notifications } from '@founders-coffee/domain';
import { formatDate } from '@founders-coffee/i18n';
import {
  eventUrlFor,
  resolveNotificationContext,
  type NotificationContext,
} from './context.js';
import { armNotificationSchedule } from './schedule.js';
import {
  pushPayloadFor,
  smsBodyFor,
  type TemplateValues,
} from './templates.js';
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

/**
 * Refuse to persist a payload the sweep would later reject.
 *
 * The contract is enforced on both sides of the row: the producer cannot write a shape the
 * dispatcher cannot parse, so an `invalid_payload` failure can only ever mean a row older than this
 * schema or one written by something else. Throwing is right here — the caller is inside the RSVP
 * transaction path, and a malformed notification is a bug in this file, not a user error.
 */
export const validPayload = (
  channel: 'sms' | 'email' | 'push',
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
    marketCode: payload.marketCode,
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
 * Push first, SMS only as the fallback behind it, and no email at all. Each reminder used to be
 * enqueued twice — once on SMS or email and once on push — so a member with a phone and a device
 * received the same reminder through two channels at the same moment. CO-02 removes that: one row
 * per reminder, `push` with `fallback_channel = 'sms'` where a verified number exists, and the
 * fallback is reached the way every other fallback is, by the primary failing permanently. PF-07a's
 * guard makes that path real — a member with no live device fails push permanently, which is
 * exactly the condition that writes the SMS row.
 *
 * Email is deliberately absent. §5 of the community-operations plan retains it for authentication
 * and for a workflow a member explicitly chose, and an event reminder is neither; sending one
 * anyway is how a product ends up with a channel nobody picked and nobody can turn off.
 *
 * The SMS fallback is written only where the member has affirmatively consented to it — a verified
 * number is necessary and not sufficient, per §5 of the profile plan, where push and SMS fallback
 * both default disabled. Deciding it here as well as at send time is not redundant: a row written
 * with no fallback channel can never produce an SMS, whatever a later bug in the dispatcher does.
 *
 * A member with neither a live device nor a consented number receives nothing, and that is the
 * designed outcome rather than a gap: the event is on their profile and in the app, and inventing a
 * channel to reach them with would undo the decision above.
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
  const context = await resolveNotificationContext(db, {
    preferred: opts.locale,
    marketCode: opts.marketCode,
  });
  const locale = context.locale;
  const now = Date.now();
  const startsAtMs = opts.startsAt.getTime();
  const contact = await getNotificationContact(db, opts.userId);
  const smsAllowed = Boolean(
    opts.phoneNumber &&
    contact?.phoneNumberVerified &&
    contact.smsFallbackEnabled,
  );
  const channel = 'push' as const;
  const fallback: 'sms' | undefined = smsAllowed ? 'sms' : undefined;

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

  let earliest: Date | null = null;

  const enqueueOnPush = async (
    templateKey: 'rsvp_confirmation' | 'reminder_72h' | 'reminder_24h',
    sendAt: Date,
  ): Promise<void> => {
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
      smsBody: smsBodyFor(
        templateKey,
        valuesFor(basePayload, context, false),
        locale,
      ),
    };

    await enqueueNotification(db, {
      id: id('ntf'),
      eventId: opts.eventId,
      userId: opts.userId,
      channel,
      templateKey,
      payload: fallback
        ? validPayload('sms', validPayload(channel, payload))
        : validPayload(channel, payload),
      sendAt,
      fallbackChannel: fallback,
    });

    if (!earliest || sendAt < earliest) earliest = sendAt;
  };

  await enqueueOnPush('rsvp_confirmation', new Date());

  if (startsAtMs - now > SEVENTY_TWO_HOURS_MS)
    await enqueueOnPush(
      'reminder_72h',
      new Date(startsAtMs - SEVENTY_TWO_HOURS_MS),
    );

  if (startsAtMs - now > TWENTY_FOUR_HOURS_MS)
    await enqueueOnPush(
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
