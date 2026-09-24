import { AppError, err, ok, type Result } from '@founders-coffee/core';
import {
  cancelNotificationsByEvent,
  getEvent,
  transitionEventStatus,
  type Db,
  type Event,
} from '@founders-coffee/db';
import { logger, reportError } from '@founders-coffee/observability';

import { enqueueEventCancellationNotices } from '../notifications/cancellation.js';
import { announceTelegramCancellation } from '../telegram/notices.js';

/**
 * Call off a meetup on its host's behalf.
 *
 * Cancelling is a status flip rather than a delete, deliberately: the page has to survive so that
 * someone who already said yes — and who may be standing outside the café — can open the link they
 * saved and read why nobody is coming. A deleted row would give them a 404 and no explanation.
 *
 * Three things happen in order, and the order is the point:
 *
 * 1. `published → cancelled` is conditional on the row still being `published`, so two taps from
 *    two devices cannot both "succeed" and fan out two rounds of notices; the second sees zero rows
 *    changed and is answered as the no-op it is.
 * 2. Pending reminders are dropped *before* the notices are queued. A `reminder_24h` still sitting
 *    in the table when the cancellation is announced would land afterwards and tell the same person
 *    to come.
 * 3. The notices go out, and then the meetup's Telegram group is told, if it has one: the bot
 *    posts the cancellation, rewrites the pin and leaves. Queued before the withdrawal, that post
 *    would have been withdrawn along with the group's own reminder.
 *
 * A failure to notify does not roll the cancellation back — the meetup really is off, and leaving
 * it published to preserve an all-or-nothing story would put people in a café for an event the host
 * has already walked away from. The failure is reported instead, and the outcome says how many
 * people were reached so a caller can tell "nobody to tell" from "could not tell anyone".
 *
 * A meetup that has finished cannot be called off, because calling it off is a claim about the
 * future and there is no future left to change. The flip would tell everyone who came that it was
 * cancelled, and then refuse the closeout, the feedback and the repeat template for good — the
 * whole record of an evening that happened, destroyed by one tap with no way back. Cancelling
 * *during* the meetup stays allowed: one that collapses in its first ten minutes is a real thing a
 * host needs to say. An event with no end is not refused, because it cannot be shown to have
 * finished; `createEventSchema` requires an end, so that is legacy and fixture data rather than
 * anything the product makes. The order matters too — an already-cancelled event answers as the
 * no-op it is before this guard is reached, so cancelling twice never turns into an error.
 */
export const cancelEventResolver = async (
  db: Db,
  opts: {
    eventId: string;
    actorId: string;
    reason?: string;
  },
): Promise<Result<{ event: Event; notified: number }>> => {
  const event = await getEvent(db, opts.eventId);
  if (!event) {
    return err(new AppError('event_not_found', 'Event not found'));
  }
  if (event.hostId !== opts.actorId) {
    return err(
      new AppError('event_not_host', 'Only the host can cancel this event'),
    );
  }
  if (event.status === 'cancelled') {
    return ok({ event, notified: 0 });
  }
  if (event.endsAt !== null && event.endsAt.getTime() <= Date.now()) {
    return err(
      new AppError('event_already_ended', 'This meetup has already ended'),
    );
  }

  const reason = opts.reason?.trim() || undefined;
  const changed = await transitionEventStatus(
    db,
    opts.eventId,
    'published',
    'cancelled',
    { cancellationReason: reason ?? null },
  );
  if (changed === 0) {
    const current = await getEvent(db, opts.eventId);
    return current
      ? ok({ event: current, notified: 0 })
      : err(new AppError('event_not_found', 'Event not found'));
  }

  logger.info('event_cancelled', {
    eventId: event.id,
    hostId: event.hostId,
    marketCode: event.marketCode,
    hasReason: Boolean(reason),
  });

  let notified = 0;
  try {
    await cancelNotificationsByEvent(db, { eventId: opts.eventId });
    notified = await enqueueEventCancellationNotices(db, {
      eventId: event.id,
      hostId: event.hostId,
      eventTitle: event.title,
      eventSlug: event.slug,
      marketCode: event.marketCode,
      startsAt: event.startsAt,
      venue: event.venue,
      reason,
    });
  } catch (error) {
    reportError(error, {
      operation: 'cancel_event_notices',
      eventId: event.id,
    });
  }

  const cancelled: Event = {
    ...event,
    status: 'cancelled',
    cancelledAt: new Date(),
    cancellationReason: reason ?? null,
  };
  try {
    await announceTelegramCancellation(db, { event: cancelled, reason });
  } catch (error) {
    reportError(error, {
      operation: 'cancel_event_telegram',
      eventId: event.id,
    });
  }

  return ok({ event: cancelled, notified });
};
