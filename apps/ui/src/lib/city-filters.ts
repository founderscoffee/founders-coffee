import { LOCALES, type Locale } from '@founders-coffee/i18n';
import type { EventFeedItem } from '@founders-coffee/server-fns';

export type CityFilterKey = 'today' | 'weekend' | Locale;

export const CITY_FILTER_KEYS: readonly CityFilterKey[] = [
  'today',
  'weekend',
  ...LOCALES,
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

const inLanguage =
  (language: Locale) =>
  (event: EventFeedItem): boolean =>
    event.language === language;

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
  ar: inLanguage('ar'),
  en: inLanguage('en'),
  fr: inLanguage('fr'),
};

const isLanguage = (key: CityFilterKey): key is Locale =>
  (LOCALES as readonly string[]).includes(key);

/**
 * Narrows a feed to the meetups the active chips ask for.
 *
 * There is a chip per language the site is read in, taken from `LOCALES` rather than listed
 * again. A host never chooses what language their meetup is in — it is recorded as whichever one
 * they were reading the site in when they created it — so every language the site speaks produces
 * meetups, and the list here named `ar` and `fr` only, leaving English ones with no chip that
 * could find them. Spelling the languages out a second time is what let the two lists drift;
 * taken from the one source they cannot, and `CityFilterKey` keys both the predicates below and
 * the labels beside them, so a fourth language stops the build until it has both.
 *
 * The language chips answer together and the rest answer separately: Arabic and French means
 * either of them, while Arabic and Today means both. A meetup is held in one language, so chips
 * that all had to match at once could only ever agree on a language when one was chosen — asking
 * for two was a way to be told there was nothing, whichever two, every time. Reading it as
 * either is also the only reading that lets the chips say something they previously could not,
 * which is the sole reason a reader would turn on two of them.
 *
 * Turning all the language chips on therefore shows everything, the same as turning none on. It
 * says the same thing, and a reader who works through them one at a time should not fall off the
 * end into an empty page. No chips at all lands there by the same route rather than by a test of
 * its own: nothing to match against is already everything, on both halves.
 */
export const applyCityFilters = (
  events: readonly EventFeedItem[],
  active: readonly CityFilterKey[],
  timezone: string,
  now: Date,
): readonly EventFeedItem[] => {
  const languages = active.filter(isLanguage);
  const dates = active.filter((key) => !isLanguage(key));
  return events.filter(
    (event) =>
      dates.every((key) => PREDICATES[key](event, timezone, now)) &&
      (languages.length === 0 ||
        languages.some((key) => PREDICATES[key](event, timezone, now))),
  );
};
