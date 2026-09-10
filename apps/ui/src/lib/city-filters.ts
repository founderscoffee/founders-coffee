import type { EventFeedItem } from '@founders-coffee/server-fns';

export type CityFilterKey = 'today' | 'weekend' | 'ar' | 'fr';

export const CITY_FILTER_KEYS: readonly CityFilterKey[] = [
  'today',
  'weekend',
  'ar',
  'fr',
];

/**
 * Splits an instant into the calendar day and weekday a viewer in `timezone` would call it.
 * The market's timezone, not the browser's: an 18:00 Algiers meetup is still "today" for
 * someone reading the page from Dubai, and the weekend it falls on is Algeria's.
 */
const dayParts = (value: Date, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const find = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    day: `${find('year')}-${find('month')}-${find('day')}`,
    weekday: find('weekday'),
  };
};

const PREDICATES: Record<
  CityFilterKey,
  (event: EventFeedItem, timezone: string, now: Date) => boolean
> = {
  today: (event, timezone, now) =>
    dayParts(new Date(event.startsAt), timezone).day ===
    dayParts(now, timezone).day,
  weekend: (event, timezone) => {
    const { weekday } = dayParts(new Date(event.startsAt), timezone);
    return weekday === 'Fri' || weekday === 'Sat';
  },
  ar: (event) => event.language === 'ar',
  fr: (event) => event.language === 'fr',
};

/**
 * Narrows a feed to the events matching every active filter. Filters combine with AND, as in
 * the design: turning on both language chips asks for a meetup held in Arabic and French at
 * once, which is empty, rather than the union the chips give no way to express.
 */
export const applyCityFilters = (
  events: readonly EventFeedItem[],
  active: readonly CityFilterKey[],
  timezone: string,
  now: Date,
): readonly EventFeedItem[] =>
  active.length === 0
    ? events
    : events.filter((event) =>
        active.every((key) => PREDICATES[key](event, timezone, now)),
      );
