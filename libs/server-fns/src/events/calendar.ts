import {
  eventShortPath,
  type CalendarTarget,
  type Locale,
} from '@founders-coffee/core';
import { getEventCalendar, type Db } from '@founders-coffee/db';
import { events } from '@founders-coffee/domain';

export type EventCalendarAnswer =
  | { readonly kind: 'file'; readonly body: string }
  | { readonly kind: 'redirect'; readonly location: string };

export type EventCalendarRequest = {
  readonly id: string;
  readonly locale: Locale;
  readonly target: CalendarTarget;
  readonly origin: string;
};

/**
 * How the calendar address answers for one meetup, or nothing when no meetup has the id.
 *
 * A published meetup answers as its `.ics` file, or as a redirect to Google Calendar's form filled
 * in. Either way the entry links back to the meetup's short address, in the language the entry was
 * asked for and on the origin that served it.
 *
 * A cancelled meetup answers with its own page instead, which says it is off and why. Nobody should
 * be handed a calendar entry for a gathering that is not happening, and the link that asked for one,
 * in a confirmation email sent before the host called it off, lands somewhere that explains.
 */
export const answerEventCalendar = async (
  db: Db,
  request: EventCalendarRequest,
): Promise<EventCalendarAnswer | null> => {
  const row = await getEventCalendar(db, request.id);
  if (!row) return null;
  const page = `${request.origin}${eventShortPath(request.locale, request.id)}`;
  if (row.status !== 'published') return { kind: 'redirect', location: page };
  const entry = { ...row, id: request.id, url: page };
  return request.target === 'google'
    ? { kind: 'redirect', location: events.googleCalendarUrlFor(entry) }
    : { kind: 'file', body: events.icsFor(entry) };
};
