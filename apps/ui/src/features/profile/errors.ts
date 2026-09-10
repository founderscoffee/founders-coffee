import { appErrorCode } from '@founders-coffee/core';
import {
  photo_failed,
  photo_reservation_expired,
  photo_storage_unavailable,
  photo_too_large,
  photo_too_small,
  photo_unsupported,
  profile_conflict_error,
  profile_save_error,
  profile_name_invalid,
  profile_security_error,
  type Locale,
} from '@founders-coffee/i18n';

const PHOTO_MESSAGES = {
  photo_too_large,
  photo_too_small,
  photo_unsupported,
  photo_reservation_expired,
  photo_storage_unavailable,
} as const;

/**
 * Say what went wrong with a photo, in the member's language.
 *
 * The upload endpoint answers with a `code` rather than a status number precisely so this mapping
 * can exist: "that photo is too small" is actionable and "422" is not. Anything unrecognised —
 * including a reservation the server has already spent — falls back to asking them to try again,
 * because there is nothing more specific that is also true.
 */
export const photoErrorMessage = (code: string, locale: Locale): string => {
  const message = PHOTO_MESSAGES[code as keyof typeof PHOTO_MESSAGES];
  return (message ?? photo_failed)({}, { locale });
};

export const profileErrorMessage = (error: unknown, locale: Locale): string => {
  const code = appErrorCode(error);
  if (code === 'profile_conflict')
    return profile_conflict_error({}, { locale });
  if (code === 'validation_failed') return profile_name_invalid({}, { locale });
  if (
    code.startsWith('turnstile') ||
    code === 'security_configuration_error' ||
    code === 'rate_limited'
  ) {
    return profile_security_error({}, { locale });
  }
  return profile_save_error({}, { locale });
};
