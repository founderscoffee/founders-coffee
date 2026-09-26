import { shortId } from './ids.js';
import type { Locale } from './locale.js';

export const CALENDAR_TARGETS = ['ics', 'google'] as const;

export type CalendarTarget = (typeof CALENDAR_TARGETS)[number];

/**
 * The short address a meetup is handed out at: ASCII and a fixed length whatever its title says,
 * answered by a redirect to the canonical page in the language it leads with.
 */
export const eventShortPath = (locale: Locale, eventId: string): string =>
  `/${locale}/e/${shortId(eventId)}`;

/**
 * The address that answers a meetup as a calendar entry: the `.ics` file by default, or with
 * `to=google` a redirect to Google Calendar's own form, filled in.
 *
 * Built here once because three places have to agree on it: the event page offers it, the
 * confirmation email links to it, and the route parses it back. It sits outside the locale prefix
 * because what fetches it is a calendar app or a download rather than a reader, so the language
 * rides in `l` instead, and names the page the entry links back to.
 */
export const eventCalendarPath = (
  locale: Locale,
  eventId: string,
  target: CalendarTarget,
): string =>
  `/cal/e/${shortId(eventId)}?l=${locale}${target === 'google' ? '&to=google' : ''}`;
