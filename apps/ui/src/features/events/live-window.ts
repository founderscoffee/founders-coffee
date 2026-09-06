const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_DURATION_MS = 2 * HOUR_MS;

export const LIVE_WINDOW_LEAD_MS = HOUR_MS;

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
 * meetup runs and is only used to decide when to close the room.
 */
export const isLiveWindowOpen = (
  startsAt: Date | number,
  endsAt: Date | number | null | undefined,
  now: number = Date.now(),
): boolean => {
  const start = new Date(startsAt).getTime();
  if (!Number.isFinite(start)) return false;

  const end =
    endsAt == null ? start + DEFAULT_DURATION_MS : new Date(endsAt).getTime();
  const closesAt = Number.isFinite(end) ? end : start + DEFAULT_DURATION_MS;

  return now >= start - LIVE_WINDOW_LEAD_MS && now <= closesAt;
};
