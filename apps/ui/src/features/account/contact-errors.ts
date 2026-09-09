import { appErrorCode } from '@founders-coffee/core';
import {
  error_contact_change_failed,
  error_contact_code_expired,
  error_contact_code_invalid,
  error_contact_code_required,
  error_contact_taken,
  error_contact_unchanged,
  error_last_sign_in_method,
  error_sms_unavailable,
  profile_security_error,
  type Locale,
} from '@founders-coffee/i18n';

const MESSAGES = {
  contact_taken: error_contact_taken,
  contact_code_invalid: error_contact_code_invalid,
  contact_code_expired: error_contact_code_expired,
  contact_code_required: error_contact_code_required,
  contact_unchanged: error_contact_unchanged,
  sms_unavailable: error_sms_unavailable,
  last_sign_in_method: error_last_sign_in_method,
} as const;

/**
 * Say why an account action was refused, in the member's language.
 *
 * The server answers with a code from a fixed set precisely so this can exist: the upstream refusal
 * is an English sentence written for a developer, and some of them describe another account. A code
 * this product owns can be translated; a message it did not write cannot.
 */
export const contactErrorMessage = (error: unknown, locale: Locale): string => {
  const code = appErrorCode(error);
  const message = MESSAGES[code as keyof typeof MESSAGES];
  if (message) return message({}, { locale });
  if (code.startsWith('turnstile') || code === 'rate_limited')
    return profile_security_error({}, { locale });
  return error_contact_change_failed({}, { locale });
};
