import { AppError, err, id, ok, type Result } from '@founders-coffee/core';
import {
  cancelRsvp as cancelRsvpRow,
  createRsvp as createRsvpRow,
  getEvent,
  getRsvpForUser,
  getUser,
  type Db,
} from '@founders-coffee/db';

import {
  cancelRsvpNotifications,
  enqueueRsvpNotifications,
} from '../notifications/producer.js';

export interface RsvpResult {
  readonly status: 'going';
}

/**
 * Create an RSVP for an event.
 *
 * Rejects with `event_not_found` for a missing event, `event_not_available` for one that is not
 * published, `already_rsvpd` when the member already holds a seat, and `event_full` at capacity.
 * Capacity and duplication are both decided by `createRsvp`'s atomic batch, not by the reads above
 * it: the `getRsvpForUser` lookup is a fast path that keeps the common case off the write path, and
 * a member who slips past it is still rejected by `UNIQUE(event_id, user_id)`.
 *
 * Notifications (confirmation + reminders) are enqueued only when a seat was actually taken.
 */
export const createRsvpResolver = async (
  db: Db,
  opts: {
    eventId: string;
    userId: string;
  },
): Promise<Result<RsvpResult>> => {
  const event = await getEvent(db, opts.eventId);
  if (!event) {
    return err(new AppError('event_not_found', 'Event not found'));
  }
  if (event.status !== 'published') {
    return err(
      new AppError('event_not_available', 'This event is no longer available'),
    );
  }

  const existing = await getRsvpForUser(db, {
    eventId: opts.eventId,
    userId: opts.userId,
  });
  if (existing) {
    return err(
      new AppError('already_rsvpd', 'You are already attending this event'),
    );
  }

  const { outcome } = await createRsvpRow(db, {
    id: id('rsvp'),
    eventId: opts.eventId,
    userId: opts.userId,
  });

  if (outcome === 'event_full') {
    return err(new AppError('event_full', 'This event is full'));
  }
  if (outcome === 'already_rsvpd') {
    return err(
      new AppError('already_rsvpd', 'You are already attending this event'),
    );
  }

  const user = await getUser(db, opts.userId);
  if (user) {
    await enqueueRsvpNotifications(db, {
      eventId: opts.eventId,
      userId: opts.userId,
      eventTitle: event.title,
      eventSlug: event.slug,
      marketCode: event.marketCode,
      startsAt: event.startsAt,
      venue: event.venue,
      phoneNumber: user.phoneNumber,
      email: user.email,
      locale: user.localePref,
    });
  }

  return ok({ status: 'going' });
};

/**
 * Cancel an RSVP. Validates ownership (only the RSVP owner can cancel).
 * Returns `rsvp_not_found` if no active RSVP exists.
 */
export const cancelRsvpResolver = async (
  db: Db,
  opts: {
    eventId: string;
    userId: string;
  },
): Promise<Result<{ deleted: boolean }>> => {
  const event = await getEvent(db, opts.eventId);
  if (!event) {
    return err(new AppError('event_not_found', 'Event not found'));
  }

  const existing = await getRsvpForUser(db, {
    eventId: opts.eventId,
    userId: opts.userId,
  });
  if (!existing) {
    return err(
      new AppError('rsvp_not_found', 'You are not attending this event'),
    );
  }

  const result = await cancelRsvpRow(db, {
    eventId: opts.eventId,
    userId: opts.userId,
  });

  if (result.deleted) {
    await cancelRsvpNotifications(db, {
      eventId: opts.eventId,
      userId: opts.userId,
    });
  }

  return ok({ deleted: result.deleted });
};
