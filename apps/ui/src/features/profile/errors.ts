import { appErrorCode } from '@founders-coffee/core';
import {
  profile_conflict_error,
  profile_save_error,
  profile_name_invalid,
  profile_photo_unavailable,
  profile_security_error,
  type Locale,
} from '@founders-coffee/i18n';

export const profileErrorMessage = (error: unknown, locale: Locale): string => {
  const code = appErrorCode(error);
  if (code === 'profile_conflict')
    return profile_conflict_error({}, { locale });
  if (code === 'validation_failed') return profile_name_invalid({}, { locale });
  if (code === 'profile_photo_unavailable')
    return profile_photo_unavailable({}, { locale });
  if (
    code.startsWith('turnstile') ||
    code === 'security_configuration_error' ||
    code === 'rate_limited'
  ) {
    return profile_security_error({}, { locale });
  }
  return profile_save_error({}, { locale });
};
