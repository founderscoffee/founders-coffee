import { AppError, err, ok, type Result } from '@founders-coffee/core';
import type { EventUpdateInput } from '@founders-coffee/domain';
import {
  cancelNotificationsByTemplate,
  getEvent,
  listGoingAttendees,
  updateEventIfCurrent,
  type Db,
  type Event,
} from '@founders-coffee/db';
import { logger, reportError } from '@founders-coffee/observability';

import { locatePoint } from '../maps/locate.js';
import type { MapProvider } from '../maps/provider.js';
import { enqueueRsvpNotifications } from '../notifications/producer.js';
import { enqueueEventRescheduleNotices } from '../notifications/reschedule.js';

const RESCHEDULED_TEMPLATES = ['reminder_72h', 'reminder_24h'] as const;

const hasMoved = (event: Event, input: EventUpdateInput): boolean =>
  event.startsAt.getTime() !== input.startsAt ||
  (event.endsAt?.getTime() ?? null) !== input.endsAt;

/**
 * Re-arm the reminders around a start time that moved.
 *
 * Reminders carry an absolute `sendAt` computed from the start they were written for, so a meetup
 * pushed from Friday to Sunday keeps a 24-hour reminder pointing at Thursday night — it would reach
 * people two days early, describing a time that is no longer true. The pending ones are withdrawn
 * and written again against the new start.
 *
 * The producer skips anyone who already has a pending row of that kind, which is why the withdrawal
 * has to happen first: re-arming over live rows would no-op and leave the stale ones in place.
 */
const rearmReminders = async (
  db: Db,
  event: Event,
  startsAt: Date,
): Promise<void> => {
  await cancelNotificationsByTemplate(db, {
    eventId: event.id,
    templateKeys: [...RESCHEDULED_TEMPLATES],
  });
  for (const attendee of await listGoingAttendees(db, event.id)) {
    await enqueueRsvpNotifications(db, {
      eventId: event.id,
      userId: attendee.userId,
      eventTitle: event.title,
      eventSlug: event.slug,
      marketCode: event.marketCode,
      startsAt,
      venue: event.venue,
      phoneNumber: attendee.phoneNumber,
      email: attendee.email,
      locale: attendee.localePref,
      remindersOnly: true,
    });
  }
};

/**
 * Change a meetup that is already published, on its host's behalf.
 *
 * Editing exists because the alternative was cancelling. A host who mistyped a title, or whose café
 * moved them to a different room, had one control — and cancelling tells everyone the meetup is off
 * and releases every booking. In a first market where four people said yes, that is the difference
 * between the evening happening and not (#14).
 *
 * What may change and what may not is a product decision, not a technical one. The title, the
 * description, the venue and the schedule are the host's to correct. The market, state and city are
 * not: people found this gathering in their own city, and moving it somewhere else would not be an
 * edit but a different meetup wearing the same RSVPs. A venue whose coordinates resolve to another
 * city is refused for that reason rather than silently relocating everyone.
 *
 * The point is only geocoded again when the caller sends one and it differs from the stored one.
 * Re-deriving it on every save would cost a provider call to fix a typo, and it would also overrule
 * the host: creation lets them name the city themselves on the confirmation step, and a derived
 * city need not agree with the one they chose. An edit that sends no point keeps the city and the
 * address exactly as they were, so correcting a title cannot quietly relabel where the meetup is —
 * which matters because most rows carry no coordinates at all, and a form forced to send a number
 * would send a placeholder the resolver could not tell from a real move.
 *
 * The slug is never regenerated. It was derived from the title once, at creation, and every link
 * already pasted into a WhatsApp thread points at it; rebuilding it from a corrected title would
 * turn each of those into a 404 as the reward for fixing a typo.
 *
 * Two kinds of edit come out of this. A quiet one — wording, a venue's name — changes the page and
 * tells nobody. A move in time is loud: everyone still going is told, because somebody planning
 * their evening around the old time has to hear about the new one. The order matters, and mirrors
 * the cancellation path: the stale reminders are withdrawn and rewritten before the notice goes
 * out, so nothing already queued can arrive afterwards still describing the old time.
 *
 * SMS is deliberately not used here. ND-07 keeps it for one thing — telling somebody not to set off
 * for a gathering that is not happening — and a meetup that is still happening, an hour later than
 * it was, is not that.
 *
 * A failure to notify does not roll the edit back. The new time is the true one the moment it is
 * written, and refusing the edit to preserve an all-or-nothing story would leave the host staring
 * at the wrong time with no way to fix it. The failure is reported and the count returned, so a
 * caller can tell "nobody to tell" from "could not tell anyone".
 */
export const updateEventResolver = async (
  db: Db,
  mapProvider: MapProvider,
  opts: {
    eventId: string;
    actorId: string;
    input: EventUpdateInput;
  },
): Promise<
  Result<{ event: Event; notified: number; rescheduled: boolean }>
> => {
  const event = await getEvent(db, opts.eventId);
  if (!event) return err(new AppError('event_not_found', 'Event not found'));
  if (event.hostId !== opts.actorId)
    return err(
      new AppError('event_not_host', 'Only the host can edit this event'),
    );
  if (event.status === 'cancelled')
    return err(
      new AppError('event_is_cancelled', 'This meetup has been cancelled'),
    );
  if (event.endsAt !== null && event.endsAt.getTime() <= Date.now())
    return err(
      new AppError('event_already_ended', 'This meetup has already ended'),
    );

  const point =
    opts.input.latitude !== undefined && opts.input.longitude !== undefined
      ? { latitude: opts.input.latitude, longitude: opts.input.longitude }
      : null;
  const relocated =
    point !== null &&
    (event.latitude !== point.latitude || event.longitude !== point.longitude);
  let venueAddress = event.venueAddress;
  let latitude = event.latitude;
  let longitude = event.longitude;
  if (relocated && point) {
    latitude = point.latitude;
    longitude = point.longitude;
    const located = await locatePoint(mapProvider, {
      marketCode: event.marketCode,
      locale: opts.input.language,
      latitude: point.latitude,
      longitude: point.longitude,
      snapshotProviderId: opts.input.venueProviderId,
      fallbackAddress: opts.input.venueAddress,
    });
    if (!located.ok) return located;
    if (located.data.cityCode !== event.cityCode)
      return err(
        new AppError(
          'event_city_immutable',
          'A published meetup cannot move to another city',
        ),
      );
    venueAddress = located.data.address;
  }

  const rescheduled = hasMoved(event, opts.input);
  const startsAt = new Date(opts.input.startsAt);
  const endsAt = new Date(opts.input.endsAt);

  const changed = await updateEventIfCurrent(
    db,
    opts.eventId,
    opts.input.expectedVersion,
    {
      title: opts.input.title,
      description: opts.input.description,
      venue: opts.input.venueName,
      venueAddress,
      latitude,
      longitude,
      startsAt,
      endsAt,
      language: opts.input.language,
    },
  );
  if (changed === 0)
    return err(
      new AppError(
        'event_conflict',
        'This meetup changed while you were editing it',
      ),
    );

  logger.info('event_updated', {
    eventId: event.id,
    hostId: event.hostId,
    marketCode: event.marketCode,
    rescheduled,
  });

  const updated: Event = {
    ...event,
    title: opts.input.title,
    description: opts.input.description,
    venue: opts.input.venueName,
    venueAddress,
    latitude,
    longitude,
    startsAt,
    endsAt,
    language: opts.input.language,
    version: opts.input.expectedVersion + 1,
    updatedAt: new Date(),
  };

  if (!rescheduled) return ok({ event: updated, notified: 0, rescheduled });

  let notified = 0;
  try {
    await rearmReminders(db, updated, startsAt);
    notified = await enqueueEventRescheduleNotices(db, {
      eventId: updated.id,
      hostId: updated.hostId,
      eventTitle: updated.title,
      eventSlug: updated.slug,
      marketCode: updated.marketCode,
      startsAt,
      venue: updated.venue,
    });
  } catch (error) {
    reportError(error, {
      operation: 'update_event_notices',
      eventId: updated.id,
    });
  }

  return ok({ event: updated, notified, rescheduled });
};
