import { formatDate, type Locale } from '@founders-coffee/i18n';

/**
 * The day a meetup falls on and the time it starts, as its card and its search snippet both say them.
 *
 * Formatted in the market's timezone rather than the renderer's, for the same reason the event page
 * is: a card or a snippet generated in UTC would tell half the readers the wrong evening.
 */
export const eventWhen = (
  startsAt: Date,
  timezone: string,
  locale: Locale,
): { readonly day: string; readonly clock: string } => {
  const on = (options: Intl.DateTimeFormatOptions): string =>
    formatDate(startsAt, locale, {
      timeZone: timezone,
      hour12: false,
      ...options,
    });
  return {
    day: on({ weekday: 'long', day: 'numeric', month: 'long' }),
    clock: on({ hour: '2-digit', minute: '2-digit' }),
  };
};
