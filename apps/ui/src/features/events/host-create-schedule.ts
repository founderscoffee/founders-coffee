import { events } from '@founders-coffee/domain';
import { formatDate, type Locale } from '@founders-coffee/i18n';

export interface HostScheduleSummary {
  readonly hasValidTimeRange: boolean;
  readonly whenLabel: string;
  readonly durationMinutes: number;
}

/**
 * The schedule as the stepper and confirmation show it.
 *
 * Rendered in the market's own time zone, never the browser's, so a host in Paris arranging an
 * Algiers meetup reads back the local time their attendees will turn up at. Validity is the shared
 * schedule schema rather than a second opinion, so the summary can never claim a range the server
 * would reject.
 */
export const hostScheduleSummary = (
  startsAt: number | null,
  endsAt: number | null,
  locale: Locale,
  timeZone: string,
): HostScheduleSummary => ({
  hasValidTimeRange:
    startsAt !== null &&
    endsAt !== null &&
    events.eventScheduleSchema.safeParse({ startsAt, endsAt }).success,
  whenLabel: startsAt
    ? formatDate(new Date(startsAt), locale, {
        timeZone,
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '',
  durationMinutes:
    startsAt && endsAt ? Math.round((endsAt - startsAt) / 60_000) : 0,
});
