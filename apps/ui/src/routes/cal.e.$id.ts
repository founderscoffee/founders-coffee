import { createFileRoute } from '@tanstack/react-router';

import { appErrorCode, prefixedId } from '@founders-coffee/core';
import { isLocale } from '@founders-coffee/i18n';
import { reportError } from '@founders-coffee/observability';
import { getEventCalendarAnswer } from '@founders-coffee/server-fns';

const NO_STORE = { 'cache-control': 'no-store' } as const;

const ICS_HEADERS = {
  ...NO_STORE,
  'content-type': 'text/calendar; charset=utf-8',
  'content-disposition': 'attachment; filename="founders-coffee.ics"',
} as const;

const calendarRequest = (request: Request) => {
  const url = new URL(request.url);
  const requested = url.searchParams.get('l');
  return {
    id: prefixedId('evt', url.pathname.split('/').pop() ?? ''),
    locale: isLocale(requested) ? requested : 'ar',
    target: url.searchParams.get('to') === 'google' ? 'google' : 'ics',
  } as const;
};

const nothing = (status: number): Response =>
  new Response(null, { status, headers: NO_STORE });

/**
 * A meetup as a calendar entry, for whatever followed the link: the `.ics` file, or a redirect.
 *
 * Nothing here is cached. An entry that outlived an edit would put the meetup in a calendar at the
 * time it no longer happens, and each answer is one narrow read.
 *
 * The file is an attachment named with `.ics`, so a browser that does not open calendar files
 * itself saves one that a calendar app will, rather than showing a page of iCalendar text.
 *
 * An id that does not parse is a 404 like an id no meetup has: both are addresses nothing lives at.
 */
const calendarResponse = async (request: Request): Promise<Response> => {
  try {
    const answer = await getEventCalendarAnswer({
      data: calendarRequest(request),
    });
    if (!answer) return nothing(404);
    if (answer.kind === 'redirect')
      return new Response(null, {
        status: 302,
        headers: { ...NO_STORE, location: answer.location },
      });
    return new Response(answer.body, { headers: ICS_HEADERS });
  } catch (error) {
    if (appErrorCode(error) === 'validation_failed') return nothing(404);
    reportError(error, { operation: 'event_calendar' });
    return nothing(503);
  }
};

export const Route = createFileRoute('/cal/e/$id')({
  server: {
    handlers: {
      GET: ({ request }) => calendarResponse(request),
    },
  },
});
