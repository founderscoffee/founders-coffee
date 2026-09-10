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
 * 3. The notices go out.
 *
 * A failure to notify does not roll the cancellation back — the meetup really is off, and leaving
 * it published to preserve an all-or-nothing story would put people in a café for an event the host
 * has already walked away from. The failure is reported instead, and the outcome says how many
 * people were reached so a caller can tell "nobody to tell" from "could not tell anyone".
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

  return ok({
    event: {
      ...event,
      status: 'cancelled',
      cancelledAt: new Date(),
      cancellationReason: reason ?? null,
    },
    notified,
  });
};
