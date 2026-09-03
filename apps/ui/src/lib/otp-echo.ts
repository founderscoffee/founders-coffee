export const TEST_ADDRESS_DOMAIN = '@e2e.invalid';

export interface OtpEchoEnv {
  readonly APP_ENVIRONMENT?: string;
  readonly OTP_ECHO?: string;
}

/**
 * Whether a sign-in code may be written to the log for this recipient.
 *
 * The release gate has to sign a disposable host in on a deployed environment, where the code is
 * stored hashed and mailed rather than printed — so without an echo the staged smoke cannot
 * authenticate at all. Echoing one is a real weakening of the §13 redaction policy, so it is fenced
 * three ways and every fence has to hold:
 *
 * - `OTP_ECHO` must be explicitly `true`. Absent means off; there is no default-on path.
 * - The environment must not be `production`. This is the same shape as `resolveTurnstileProvider`,
 *   which refuses its bypass flag outside development rather than honouring it: a flag that leaks
 *   into production must fail closed instead of quietly disabling a control.
 * - The recipient must sit in the reserved test domain. This is the fence that matters, because it
 *   bounds the damage to accounts that exist only for the suite and hold nothing. A real member
 *   asking for a code on the same deployment still has it redacted.
 */
export const shouldEchoSignInCode = (env: OtpEchoEnv, email: string): boolean =>
  env.OTP_ECHO === 'true' &&
  env.APP_ENVIRONMENT !== 'production' &&
  email.trim().toLowerCase().endsWith(TEST_ADDRESS_DOMAIN);
