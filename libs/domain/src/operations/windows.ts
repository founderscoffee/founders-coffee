const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const CLOSEOUT_OVERDUE_AFTER_MS = 24 * HOUR_MS;
export const FEEDBACK_INVITE_WITHIN_MS = 7 * DAY_MS;
export const FEEDBACK_CLOSES_AFTER_MS = 14 * DAY_MS;

export type EventTiming = {
  readonly endsAt: number | null;
  readonly status: string;
};

/**
 * Whether an event is far enough past its end to be closed out at all.
 *
 * `endsAt === null` is not "closeable now" and not an error either: §5.24 excludes those legacy
 * rows from closeout, attendance, feedback and every completed-event metric, and they surface in an
 * admin attention state instead. Inferring a duration from `startsAt` would manufacture the exact
 * evidence this plan exists to stop manufacturing.
 *
 * A cancelled event is never closed out. Its outcome is already recorded in its publication status,
 * and a `did_not_happen` closeout on top of it would double-count the same fact in reliability
 * reporting.
 */
export const canCloseOut = (event: EventTiming, now: number): boolean =>
  event.endsAt !== null && event.status !== 'cancelled' && now >= event.endsAt;

/**
 * Whether an event should be nagging someone.
 *
 * Twenty-four hours after the end, still not cancelled, still no closeout. The delay is what makes
 * it an operational signal rather than a clock: a host who closes out on the way home and one who
 * does it the next morning are both fine, and a list that includes them is a list nobody reads.
 */
export const isCloseoutOverdue = (
  event: EventTiming,
  hasCloseout: boolean,
  now: number,
): boolean =>
  !hasCloseout &&
  event.endsAt !== null &&
  event.status !== 'cancelled' &&
  now - event.endsAt > CLOSEOUT_OVERDUE_AFTER_MS;

/**
 * Whether a closeout is early enough to invite anyone to give feedback.
 *
 * §5.20 fixes this at seven days after the event ended. The rule exists because a pulse asked three
 * weeks late measures memory rather than experience, and because inviting on a late closeout would
 * let the invitation window be reopened at will by simply closing out later.
 *
 * Only a `held` event invites. Asking how a meetup was when it did not happen is the kind of
 * question that makes a product feel like it is not paying attention.
 */
export const invitesFeedback = (
  outcome: string,
  endsAt: number | null,
  submittedAt: number,
): boolean =>
  outcome === 'held' &&
  endsAt !== null &&
  submittedAt - endsAt <= FEEDBACK_INVITE_WITHIN_MS;

/**
 * Whether the pulse can still be created or changed.
 *
 * Fourteen days after the event ended, measured from the event and never from the invitation, so a
 * closeout submitted on day six and one submitted on day one close the window at the same moment.
 * §5.20 is explicit that a late closeout does not reopen it — which is only true if the deadline
 * is anchored to `endsAt`, as it is here.
 */
export const feedbackWindowOpen = (
  endsAt: number | null,
  now: number,
): boolean => endsAt !== null && now - endsAt <= FEEDBACK_CLOSES_AFTER_MS;

/**
 * The month a completed event is counted in, in the market's own timezone.
 *
 * §6 groups completed events by the calendar month containing `endsAt` in the market timezone, not
 * in UTC. For Algiers that is UTC+1 all year, so an event ending at 23:30 on the last day of a
 * month is counted in the following month by a UTC reading and in the correct one by this. The
 * difference is small and it is the difference between a density gate that is met and one that is
 * not.
 *
 * The parts are destructured rather than searched with a fallback. `formatToParts` returns the
 * fields that were asked for, so a `?? '0000'` here would be a claim that it might not — an
 * unreachable branch that reads like a handled failure. An invalid time zone throws, which is the
 * right outcome for a market row carrying one.
 */
export const marketMonthOf = (
  endsAt: number,
  timeZone: string,
): `${number}-${string}` => {
  const [{ value: year }, , { value: month }] = new Intl.DateTimeFormat(
    'en-CA',
    { timeZone, year: 'numeric', month: '2-digit' },
  ).formatToParts(new Date(endsAt));
  return `${Number(year)}-${month}` as `${number}-${string}`;
};
