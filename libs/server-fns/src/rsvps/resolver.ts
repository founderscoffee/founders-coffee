import { AppError, err, id, ok, type Result } from '@founders-coffee/core';
import {
  cancelRsvp as cancelRsvpRow,
  createRsvp as createRsvpRow,
  getEvent,
  getRsvpForUser,
  getUser,
  withdrawStaleHostNotice,
  type Db,
} from '@founders-coffee/db';

import { enqueueHostRsvpNotice } from '../notifications/host-notice.js';
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
 * Rejects with `event_not_found` for a missing event and `event_not_available` for one that is not
 * published, both re-checked by `createRsvp`'s atomic batch rather than trusted from the reads
 * above it. Duplication is decided there too: the `getRsvpForUser` lookup is a fast path that keeps
 * the common case off the write path, and a member who slips past it is still rejected by
 * `UNIQUE(event_id, user_id)`.
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

  if (outcome === 'event_missing') {
    return err(new AppError('event_not_found', 'Event not found'));
  }
  if (outcome === 'rsvp_closed') {
    return err(
      new AppError('rsvp_closed', 'This gathering has already started'),
    );
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

  if (event.hostId !== opts.userId) {
    const host = await getUser(db, event.hostId);
    await enqueueHostRsvpNotice(db, {
      eventId: opts.eventId,
      hostId: event.hostId,
      guestId: opts.userId,
      eventTitle: event.title,
      eventSlug: event.slug,
      marketCode: event.marketCode,
      startsAt: event.startsAt,
      venue: event.venue,
      hostEmail: host?.email,
      hostLocale: host?.localePref,
    });
  }

  return ok({ status: 'going' });
};

/**
 * Cancel an RSVP. Validates ownership (only the RSVP owner can cancel).
 * Returns `rsvp_not_found` if no active RSVP exists.
 */
/**
 * Withdraw an RSVP, while withdrawing is still something a member may do.
 *
 * The row existed a moment ago — the lookup above says so — and the conditional delete still wrote
 * nothing, which leaves exactly one explanation: the gathering started in between, and §5.17 freezes
 * intent there. Reporting that as `rsvp_closed` rather than as a missing RSVP matters, because the
 * member is looking at a seat they can see and being told it is not theirs would be a lie.
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

  if (!result.deleted) {
    return err(
      new AppError('rsvp_closed', 'This gathering has already started'),
    );
  }

  await cancelRsvpNotifications(db, {
    eventId: opts.eventId,
    userId: opts.userId,
  });
  await withdrawStaleHostNotice(db, {
    eventId: opts.eventId,
    hostId: event.hostId,
  });

  return ok({ deleted: true });
};
