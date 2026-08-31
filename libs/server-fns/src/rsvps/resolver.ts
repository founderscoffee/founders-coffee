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
 * Create an RSVP for an event. Validates:
 *   - Event exists and is published
 *   - Event is not cancelled
 *   - User is not the host (optional — hosts can attend their own events)
 *   - User has not already RSVP'd (idempotent: returns `already_rsvpd`)
 *   - Event is not full (`event_full`)
 *
 * After successful RSVP, enqueues notification (confirmation + reminders)
 * via the notifications producer (P1-009).
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

  try {
    const result = await createRsvpRow(db, {
      id: id('rsvp'),
      eventId: opts.eventId,
      userId: opts.userId,
    });

    if (result.eventFull) {
      return err(new AppError('event_full', 'This event is full'));
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
        locale: user.localePref ?? 'en',
      });
    }

    return ok({ status: result.status });
  } catch (error) {
    if (error instanceof Error && error.message === 'event_full') {
      return err(new AppError('event_full', 'This event is full'));
    }
    throw error;
  }
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
