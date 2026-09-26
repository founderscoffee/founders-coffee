/**
 * Whether a request is for a meetup's calendar entry, which the service worker never answers from
 * its cache.
 *
 * An entry has to say when the meetup happens now. Serwist's catch-all keeps any response for a day
 * and answers from that copy whenever the network takes more than ten seconds, and an `.ics` saved
 * before an edit would put the meetup in a calendar at a time it no longer happens. Offline, the
 * request falls through to the offline page instead.
 */
export const isCalendarEntryPath = (pathname: string): boolean =>
  pathname.startsWith('/cal/');
