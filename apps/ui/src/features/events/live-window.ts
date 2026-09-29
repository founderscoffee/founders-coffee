const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_DURATION_MS = 2 * HOUR_MS;

export const LIVE_WINDOW_LEAD_MS = HOUR_MS;

export type EventPhase = 'upcoming' | 'started' | 'ended';

const endOf = (
  start: number,
  endsAt: Date | number | null | undefined,
): number => {
  const end =
    endsAt == null ? start + DEFAULT_DURATION_MS : new Date(endsAt).getTime();
  return Number.isFinite(end) ? end : start + DEFAULT_DURATION_MS;
};

/**
 * Whether the live room is open for an event — `LIVE_WINDOW_LEAD_MS` before the start, to the end.
 *
 * Open from an hour before the start until the end, so people on their way have somewhere to say
 * so and nobody is looking at an empty roster for a meetup next week. The comparison is between
 * absolute instants — `startsAt` is a real timestamp and `Date.now()` is one too — so it opens at
 * the same moment for a viewer in Algiers and a viewer in Paris, regardless of the wall clock
 * either of them is reading. The event's own timezone belongs to how the time is *displayed*, not
 * to when this turns true.
 *
 * An event with no recorded end is treated as running two hours, which is roughly what a coffee
 * meetup runs. `upcomingScope` in `libs/db/src/events.ts` assumes the same two hours when it
 * decides an event has stopped being discoverable; the two constants have to agree, or a meetup
 * disappears from the feed while its room is still open, or keeps a room open after the feed has
 * moved on.
 */
export const isLiveWindowOpen = (
  startsAt: Date | number,
  endsAt: Date | number | null | undefined,
  now: number = Date.now(),
): boolean => {
  const start = new Date(startsAt).getTime();
  if (!Number.isFinite(start)) return false;

  return now >= start - LIVE_WINDOW_LEAD_MS && now <= endOf(start, endsAt);
};

/**
 * Where a meetup stands: before its start, between its start and its end, or after its end.
 *
 * The RSVP box reads this to stop offering a seat from the start on, because that is when the
 * server stops taking or releasing one: `rsvp_closed` in `libs/db/src/rsvps.ts` refuses any RSVP
 * once `starts_at` is no longer ahead. The end is the one {@link isLiveWindowOpen} uses, so the box
 * says a meetup is over at the moment its room closes.
 */
export const eventPhase = (
  startsAt: Date | number,
  endsAt: Date | number | null | undefined,
  now: number = Date.now(),
): EventPhase => {
  const start = new Date(startsAt).getTime();
  if (!Number.isFinite(start) || now < start) return 'upcoming';
  return now <= endOf(start, endsAt) ? 'started' : 'ended';
};
