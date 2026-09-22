import { AppError, err, ok, type Result } from '@founders-coffee/core';
import type { EventUpdateInput } from '@founders-coffee/domain';
import {
  getEvent,
  updateEventIfCurrent,
  type Db,
  type Event,
} from '@founders-coffee/db';
import { logger } from '@founders-coffee/observability';

import { locatePoint } from '../maps/locate.js';
import type { MapProvider } from '../maps/provider.js';
import type { EventChangeTemplateKey } from '../notifications/event-change.js';
import { announceUpdate, noticeFor } from './update-notices.js';

type Point = { latitude: number; longitude: number };
type Placement = {
  latitude: number | null;
  longitude: number | null;
  venueAddress: string | null;
};

/**
 * Resolve a point the host moved the pin to, and refuse one that leaves the city.
 *
 * A point only reaches here when the caller sent one and it differs from the stored one.
 * Re-deriving it on every save would cost a provider call to fix a typo, and it would also overrule
 * the host: creation lets them name the city themselves on the confirmation step, and a derived
 * city need not agree with the one they chose. An edit that sends no point keeps the city and the
 * address exactly as they were, so correcting a title cannot quietly relabel where the meetup is —
 * which matters because most rows carry no coordinates at all.
 *
 * The market, state and city are not the host's to change. People found this gathering in their own
 * city, and moving it somewhere else would not be an edit but a different meetup wearing the same
 * RSVPs, so a point that resolves elsewhere is refused rather than silently relocating everyone.
 */
const relocate = async (
  mapProvider: MapProvider,
  event: Event,
  input: EventUpdateInput,
  point: Point,
): Promise<Result<Placement>> => {
  const located = await locatePoint(mapProvider, {
    marketCode: event.marketCode,
    locale: input.language,
    latitude: point.latitude,
    longitude: point.longitude,
    snapshotProviderId: input.venueProviderId,
    fallbackAddress: input.venueAddress,
  });
  if (!located.ok) return located;
  if (located.data.cityCode !== event.cityCode)
    return err(
      new AppError(
        'event_city_immutable',
        'A published meetup cannot move to another city',
      ),
    );
  return ok({
    latitude: point.latitude,
    longitude: point.longitude,
    venueAddress: located.data.address,
  });
};

const refuseClosed = (event: Event, actorId: string): AppError | null => {
  if (event.hostId !== actorId)
    return new AppError('event_not_host', 'Only the host can edit this event');
  if (event.status === 'cancelled')
    return new AppError('event_is_cancelled', 'This meetup has been cancelled');
  if (event.endsAt !== null && event.endsAt.getTime() <= Date.now())
    return new AppError('event_already_ended', 'This meetup has already ended');
  return null;
};

/**
 * Change a meetup that is already published, on its host's behalf.
 *
 * Editing exists because the alternative was cancelling. A host who mistyped a title, or whose café
 * moved them to a different room, had one control — and cancelling tells everyone the meetup is off
 * and releases every booking. In a first market where four people said yes, that is the difference
 * between the evening happening and not (#14).
 *
 * The slug is never regenerated. It was derived from the title once, at creation, and every link
 * already pasted into a WhatsApp thread points at it; rebuilding it from a corrected title would
 * turn each of those into a 404 as the reward for fixing a typo.
 *
 * The row is written conditionally on the version the host was looking at, which is what makes a
 * second editor's save a refusal rather than a silent overwrite — and an overwrite here is not a
 * lost paragraph but a message sent to other people about a change nobody made.
 *
 * What an edit tells people, and which queued messages it invalidates, is `update-notices.ts`'s to
 * answer. A failure there is reported rather than thrown: the new time is the true one the moment
 * it is written, and refusing the edit to keep an all-or-nothing story would leave the host staring
 * at the wrong time with no way to fix it.
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
  Result<{
    event: Event;
    notified: number;
    notice: EventChangeTemplateKey | null;
  }>
> => {
  const event = await getEvent(db, opts.eventId);
  if (!event) return err(new AppError('event_not_found', 'Event not found'));
  const refusal = refuseClosed(event, opts.actorId);
  if (refusal) return err(refusal);

  const point: Point | null =
    opts.input.latitude !== undefined && opts.input.longitude !== undefined
      ? { latitude: opts.input.latitude, longitude: opts.input.longitude }
      : null;
  const pointChanged =
    point !== null &&
    (event.latitude !== point.latitude || event.longitude !== point.longitude);
  let placed: Placement = {
    latitude: event.latitude,
    longitude: event.longitude,
    venueAddress: event.venueAddress,
  };
  if (pointChanged && point) {
    const located = await relocate(mapProvider, event, opts.input, point);
    if (!located.ok) return located;
    placed = located.data;
  }

  const updated: Event = {
    ...event,
    title: opts.input.title,
    description: opts.input.description,
    venue: opts.input.venueName,
    venueAddress: placed.venueAddress,
    latitude: placed.latitude,
    longitude: placed.longitude,
    startsAt: new Date(opts.input.startsAt),
    endsAt: new Date(opts.input.endsAt),
    language: opts.input.language,
    version: opts.input.expectedVersion + 1,
    updatedAt: new Date(),
  };
  const notice = noticeFor(event, updated, point);

  const changed = await updateEventIfCurrent(
    db,
    opts.eventId,
    opts.input.expectedVersion,
    {
      title: updated.title,
      description: updated.description,
      venue: updated.venue,
      venueAddress: updated.venueAddress,
      latitude: updated.latitude,
      longitude: updated.longitude,
      startsAt: updated.startsAt,
      endsAt: updated.endsAt,
      language: updated.language,
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
    notice,
  });

  const notified = await announceUpdate(db, {
    before: event,
    after: updated,
    notice,
  });

  return ok({ event: updated, notified, notice });
};
