export const METRIC_KEYS = [
  'completed_events',
  'did_not_happen_events',
  'rsvp_to_attendance',
  'no_show_rate',
  'recurring_hosts',
  'host_retention_60d',
  'repeat_participation',
  'return_intent',
  'host_again_intent',
  'four_week_cover',
  'overdue_closeouts',
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export const RECURRING_HOST_WINDOW_DAYS = 90;
export const RECURRING_HOST_MIN_EVENTS = 2;
export const HOST_RETENTION_WINDOW_DAYS = 60;
export const REPEAT_PARTICIPATION_WINDOW_DAYS = 90;
export const REPEAT_PARTICIPATION_MIN_EVENTS = 2;
export const SCHEDULE_COVER_DAYS = 28;
export const MONTHLY_EVENT_TARGET = 8;

export interface Ratio {
  readonly numerator: number;
  readonly denominator: number;
  readonly value: number | null;
}

/**
 * A share, with the numbers it came from and an honest `null` when there are none.
 *
 * Every §6 metric is reported with its numerator, denominator and window, so the ratio type carries
 * all three rather than a bare percentage. `value` is `null` on a zero denominator and never `0`:
 * "nobody was asked" and "everybody said no" are opposite facts, and a dashboard that renders both
 * as 0% invites exactly the wrong intervention.
 */
export const ratio = (numerator: number, denominator: number): Ratio => ({
  numerator,
  denominator,
  value: denominator === 0 ? null : numerator / denominator,
});

export interface AttendanceTally {
  readonly attended: number;
  readonly noShow: number;
}

/**
 * Registered attended over registered outcomes recorded.
 *
 * Walk-ins are absent from both sides on purpose. They are an aggregate with no RSVP behind them,
 * so counting them in the numerator would compare people who signed up against people who did not,
 * and the resulting rate could exceed 1 — §6 restricts this to "closeouts with at least one
 * recorded RSVP outcome" for that reason.
 */
export const rsvpToAttendance = (tally: AttendanceTally): Ratio =>
  ratio(tally.attended, tally.attended + tally.noShow);

export const noShowRate = (tally: AttendanceTally): Ratio =>
  ratio(tally.noShow, tally.attended + tally.noShow);

/**
 * Total turnout: the members we can name, plus the ones we counted.
 *
 * §5.5 makes this derived and never submitted, so a client cannot report a total that disagrees
 * with the attendance rows behind it.
 */
export const totalAttendance = (
  tally: AttendanceTally,
  walkInCount: number,
): number => tally.attended + walkInCount;

export interface HostHistory {
  readonly userId: string;
  readonly completedAt: readonly number[];
}

const within = (times: readonly number[], from: number, to: number): number =>
  times.filter((at) => at >= from && at <= to).length;

/** Hosts with at least two completed events in the trailing ninety days. */
export const recurringHosts = (
  hosts: readonly HostHistory[],
  now: number,
): number => {
  const from = now - RECURRING_HOST_WINDOW_DAYS * 86_400_000;
  return hosts.filter(
    (host) => within(host.completedAt, from, now) >= RECURRING_HOST_MIN_EVENTS,
  ).length;
};

/**
 * Of the hosts who have had time to come back, the share that did.
 *
 * The denominator is the subtlety and §6 states it precisely: hosts whose *first* completed event
 * is at least sixty days old. A host who ran their first meetup last week has not failed to return
 * — they have not had the chance — and counting them would make retention fall every time the
 * community recruited someone, which is the opposite of what the number is for.
 */
export const hostRetention60d = (
  hosts: readonly HostHistory[],
  now: number,
): Ratio => {
  const window = HOST_RETENTION_WINDOW_DAYS * 86_400_000;
  const eligible = hosts
    .map((host) => [...host.completedAt].sort((a, b) => a - b))
    .filter((times) => times.length > 0 && now - times[0] >= window);
  const returned = eligible.filter((times) =>
    times.slice(1).some((at) => at - times[0] <= window),
  );
  return ratio(returned.length, eligible.length);
};

export interface AttendeeHistory {
  readonly userId: string;
  readonly attendedAt: readonly number[];
}

/**
 * The share of identified attendees who came back within ninety days.
 *
 * Walk-ins are excluded from both numerator and denominator because there is no identity to repeat:
 * counting an aggregate here would put people in the denominator who can never enter the numerator,
 * and the metric would fall as walk-in turnout rose.
 */
export const repeatParticipation = (
  attendees: readonly AttendeeHistory[],
  now: number,
): Ratio => {
  const from = now - REPEAT_PARTICIPATION_WINDOW_DAYS * 86_400_000;
  const active = attendees.filter(
    (attendee) => within(attendee.attendedAt, from, now) > 0,
  );
  const repeated = active.filter(
    (attendee) =>
      within(attendee.attendedAt, from, now) >= REPEAT_PARTICIPATION_MIN_EVENTS,
  );
  return ratio(repeated.length, active.length);
};

export interface PulseTally {
  readonly yes: number;
  readonly responses: number;
}

export const returnIntent = (pulse: PulseTally): Ratio =>
  ratio(pulse.yes, pulse.responses);

export const hostAgainIntent = (pulse: PulseTally): Ratio =>
  ratio(pulse.yes, pulse.responses);

/**
 * Whether the next four weeks look like a community or a gap.
 *
 * Compared against the operating target rather than reported bare, because the number on its own
 * says nothing: eight events is healthy for a market running one a week and thin for one running
 * three. `onTarget` uses the §6 target of roughly eight completed events per month, scaled to the
 * twenty-eight day window.
 */
export const fourWeekCover = (
  scheduledEvents: number,
): {
  readonly scheduled: number;
  readonly target: number;
  readonly onTarget: boolean;
} => {
  const target = Math.round((MONTHLY_EVENT_TARGET * SCHEDULE_COVER_DAYS) / 30);
  return {
    scheduled: scheduledEvents,
    target,
    onTarget: scheduledEvents >= target,
  };
};
