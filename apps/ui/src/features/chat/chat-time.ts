import {
  chat_today,
  chat_yesterday,
  formatDate,
  type Locale,
} from '@founders-coffee/i18n';

import type { ChatDay } from './chat-items';

/** A message's time of day in the market's time zone, on the 24-hour clock the meetup page uses. */
export const messageClock = (
  at: Date,
  locale: Locale,
  timeZone: string,
): string =>
  formatDate(at, locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

/** What a day line reads: today, yesterday, or the day itself in the market's time zone. */
export const dayLabel = (
  day: ChatDay,
  date: Date,
  locale: Locale,
  timeZone: string,
): string => {
  if (day === 'today') return chat_today({}, { locale });
  if (day === 'yesterday') return chat_yesterday({}, { locale });
  return formatDate(date, locale, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
};

/**
 * A moment the chat names in its copy, such as when it turns read-only or when the meetup now
 * starts: the weekday, the date and the time on the 24-hour clock, in the market's time zone.
 */
export const momentLabel = (
  at: Date,
  locale: Locale,
  timeZone: string,
): string =>
  formatDate(at, locale, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
