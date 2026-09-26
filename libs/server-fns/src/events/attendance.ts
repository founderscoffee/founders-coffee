import type { Event, Db } from '@founders-coffee/db';
import { getRsvpsForEvents } from '@founders-coffee/db';

export interface EventAttendance {
  readonly goingCount: number;
  readonly viewerRsvp: 'going' | null;
}

export type EventWithAttendance = Event & EventAttendance;

export type EventDetailItem = EventWithAttendance & {
  readonly cityName: string;
  readonly cityNameAr: string;
  readonly cityNameFr: string;
  readonly citySlug: string | null;
};

/**
 * Attach attendance fields to a list of events. No N+1 — uses the denormalized
 * `events.rsvps` counter for `goingCount` and a single batched query for `viewerRsvp`.
 *
 * `goingCount` = `event.rsvps` (free — already on the row).
 * `viewerRsvp` = one grouped query for all events, mapped back.
 */
export const attachAttendance = async <T extends Event>(
  db: Db,
  events: readonly T[],
  viewerId?: string | null,
): Promise<(T & EventAttendance)[]> => {
  const eventIds = events.map((e) => e.id);

  const viewerRsvps = viewerId
    ? await getRsvpsForEvents(db, { eventIds, userId: viewerId })
    : new Map<string, 'going' | 'waitlist' | 'cancelled'>();

  return events.map((event) => ({
    ...event,
    goingCount: event.rsvps,
    viewerRsvp: viewerRsvps.get(event.id) === 'going' ? 'going' : null,
  }));
};
