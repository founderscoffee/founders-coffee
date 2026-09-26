import { appErrorCode } from '@founders-coffee/core';
import {
  telegram_error_closed,
  telegram_error_generic,
  rate_limited,
  telegram_error_unavailable,
  type Locale,
} from '@founders-coffee/i18n';

const CLOSED_CODES = new Set([
  'telegram_group_unavailable',
  'rsvp_not_found',
  'event_already_ended',
  'event_is_cancelled',
]);

/** What a member reads when a Telegram action is refused, chosen by the code the server gave. */
export const telegramErrorFor = (cause: unknown, locale: Locale): string => {
  const code = appErrorCode(cause);
  if (code === 'telegram_unavailable')
    return telegram_error_unavailable({}, { locale });
  if (code === 'rate_limited') return rate_limited({}, { locale });
  if (CLOSED_CODES.has(code)) return telegram_error_closed({}, { locale });
  return telegram_error_generic({}, { locale });
};
