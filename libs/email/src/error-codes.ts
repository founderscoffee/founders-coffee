/** Cloudflare Email Service error codes thrown as `Error.code` (per the Workers API docs). */
export type EmailProviderCode = string;

/** Codes that mean "try again later" — surfaced as `email_rate_limited` for the P1-009 retry/DLQ. */
export const EMAIL_RATE_LIMIT_CODES: readonly string[] = [
  'E_RATE_LIMIT_EXCEEDED',
  'E_DAILY_LIMIT_EXCEEDED',
];

/**
 * Map a Cloudflare Email Service provider code to a stable `AppError` code so callers can react:
 * `email_rate_limited` → retry (P1-009 queue DLQ), `email_recipient_suppressed` → stop sending,
 * `email_send_failed` → everything else (incl. `E_SENDER_NOT_VERIFIED`, a provisioning/config bug).
 */
export const mapEmailProviderCode = (code: EmailProviderCode): string => {
  if (EMAIL_RATE_LIMIT_CODES.includes(code)) return 'email_rate_limited';
  if (code === 'E_RECIPIENT_SUPPRESSED') return 'email_recipient_suppressed';
  return 'email_send_failed';
};

/** Read the `.code` Cloudflare sets on a thrown send error; falls back to `E_UNKNOWN`. */
export const readEmailProviderCode = (error: unknown): EmailProviderCode => {
  if (error !== null && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : 'E_UNKNOWN';
  }
  return 'E_UNKNOWN';
};
