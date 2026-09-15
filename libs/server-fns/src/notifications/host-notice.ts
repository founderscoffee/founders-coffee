import { id } from '@founders-coffee/core';
import {
  enqueueNotificationIfAbsent,
  enqueueNotificationIfNoPending,
  type Db,
} from '@founders-coffee/db';

import { resolveNotificationContext } from './context.js';
import {
  validPayload,
  valuesFor,
  type NotificationPayload,
} from './producer.js';
import { armNotificationSchedule } from './schedule.js';
import { emailPayloadFor, pushPayloadFor } from './templates.js';

export const HOST_NOTICE_DELAY_MS = 15 * 60 * 1000;

/**
 * Tell the host somebody is coming, once per burst rather than once per guest.
 *
 * A pending notice for the same event suppresses the next one, so twelve people saying yes over a
 * lunchtime produce one message and the window reopens when it sends. The delay is what makes that
 * window exist at all: enqueueing immediately would coalesce nothing, because the row is gone from
 * `pending` before the second RSVP arrives.
 *
 * It deliberately carries no count. A digest that says how many are coming would have to decide that
 * number at enqueue time — a payload is frozen when it is written — and by the time it sent it would
 * be reporting a figure that had already moved. The message says somebody joined and links to the
 * event, where the real number is. A notification that is vague is recoverable; one that is
 * confidently wrong is not.
 *
 * The delay is clamped to the start time. Somebody can RSVP a minute before the gathering begins —
 * §5.17 freezes intent at `startsAt` and not before — and a host told a quarter of an hour later
 * that a guest is on the way is being told about a room they are already sitting in.
 *
 * The host's own RSVP is not news to the host, and `hostUpdates` is enforced at send time by
 * `resolveDestination` rather than here, so a switch turned off after this row was written still
 * stops it.
 */
export const enqueueHostRsvpNotice = async (
  db: Db,
  opts: {
    eventId: string;
    hostId: string;
    guestId: string;
    eventTitle: string;
    eventSlug: string;
    marketCode: string;
    startsAt: Date;
    venue: string;
    hostEmail?: string;
    hostLocale?: string | null;
  },
): Promise<void> => {
  if (opts.guestId === opts.hostId) return;

  const templateKey = 'rsvp_received' as const;

  const context = await resolveNotificationContext(db, {
    preferred: opts.hostLocale,
    marketCode: opts.marketCode,
  });

  const basePayload: NotificationPayload = {
    email: opts.hostEmail,
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
    ...emailPayloadFor(templateKey, values, context.locale),
  };

  const channel = 'push' as const;
  const fallback: 'email' | undefined = opts.hostEmail ? 'email' : undefined;
  const sendAt = new Date(
    Math.min(Date.now() + HOST_NOTICE_DELAY_MS, opts.startsAt.getTime()),
  );

  const result = await enqueueNotificationIfNoPending(db, {
    id: id('ntf'),
    eventId: opts.eventId,
    userId: opts.hostId,
    channel,
    templateKey,
    payload: fallback
      ? validPayload('email', validPayload(channel, payload))
      : validPayload(channel, payload),
    sendAt,
    fallbackChannel: fallback,
  });

  if (result.written) await armNotificationSchedule(opts.eventId, sendAt);
};

/** Tell the host when a guest withdraws an RSVP, once for that RSVP record. */
export const enqueueHostRsvpCancellationNotice = async (
  db: Db,
  opts: {
    eventId: string;
    hostId: string;
    guestId: string;
    rsvpId: string;
    eventTitle: string;
    eventSlug: string;
    marketCode: string;
    startsAt: Date;
    venue: string;
    hostEmail?: string;
    hostLocale?: string | null;
  },
): Promise<void> => {
  if (opts.guestId === opts.hostId) return;

  const context = await resolveNotificationContext(db, {
    preferred: opts.hostLocale,
    marketCode: opts.marketCode,
  });
  const basePayload: NotificationPayload = {
    email: opts.hostEmail,
    eventTitle: opts.eventTitle,
    eventSlug: opts.eventSlug,
    marketCode: opts.marketCode,
    startsAt: opts.startsAt.toISOString(),
    venue: opts.venue,
    locale: context.locale,
  };
  const values = valuesFor(basePayload, context, true);
  const templateKey = 'rsvp_cancelled' as const;
  const payload = {
    ...basePayload,
    ...pushPayloadFor(templateKey, values, context.locale),
    ...emailPayloadFor(templateKey, values, context.locale),
  };
  const sendAt = new Date();
  const result = await enqueueNotificationIfAbsent(db, {
    id: `ntf_rsvp_cancelled_${opts.eventId}_${opts.rsvpId}`,
    eventId: opts.eventId,
    userId: opts.hostId,
    channel: 'push',
    templateKey,
    payload: opts.hostEmail
      ? validPayload('email', validPayload('push', payload))
      : validPayload('push', payload),
    sendAt,
    fallbackChannel: opts.hostEmail ? 'email' : undefined,
  });
  if (result.written) await armNotificationSchedule(opts.eventId, sendAt);
};
