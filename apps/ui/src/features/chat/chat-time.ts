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

/** The moment a chat turns read-only, as its header gives it once the meetup has ended. */
export const readOnlyLabel = (
  readOnlyAt: Date,
  locale: Locale,
  timeZone: string,
): string =>
  formatDate(readOnlyAt, locale, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
