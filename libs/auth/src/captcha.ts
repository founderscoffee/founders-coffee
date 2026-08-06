/**
 * The auth endpoints Turnstile gates: the ones that spend money by sending an SMS or an email.
 * Shared by the `captcha` plugin registration in `createAuth` and the misconfiguration guard in
 * `createAuthHandler`, so the two can never disagree about what is protected.
 *
 * The OTP *verification* steps are deliberately absent. A Turnstile token is single-use, so gating
 * them would demand a second challenge solve on the same login, and they are already bounded by the
 * `emailOTP` / `phoneNumber` plugins' `allowedAttempts: 3` over a hashed, 300-second OTP plus the
 * D1-backed rate limiter. Better Auth takes the same position: its captcha plugin exempts
 * `/sign-in/email-otp` unless that path is listed explicitly.
 *
 * Matching is substring-based on the path with the base path stripped, both here and in the plugin.
 */
export const CAPTCHA_ENDPOINTS = [
  '/email-otp/send-verification-otp',
  '/phone-number/send-otp',
  '/phone-number/request-password-reset',
] as const;

/** True when the request targets a gated endpoint. Only POST bodies reach these paths. */
export const isCaptchaGated = (pathname: string, method: string): boolean =>
  method === 'POST' &&
  CAPTCHA_ENDPOINTS.some((endpoint) => pathname.includes(endpoint));

/**
 * Stands in for the real endpoint list when the local-dev bypass is on. A path no auth route can
 * match, so the plugin verifies nothing.
 *
 * The bypass has to work this way because the `captcha` plugin must be registered
 * *unconditionally*: a conditional entry in `plugins` widens the array from a tuple to a union and
 * Better Auth loses the type augmentations the other plugins contribute (the `admin()` plugin's
 * `user.role` disappears first). An empty list is not an option either — the plugin falls back to
 * its own password-flow defaults when `endpoints` is empty.
 */
export const CAPTCHA_BYPASS_ENDPOINT = '/__turnstile-disabled__';

/**
 * The endpoint list to hand the plugin. `isBypassed` must come from an explicit
 * `TURNSTILE_DISABLED=true`; a merely missing secret key is a misconfiguration, not a bypass, and is
 * refused by `createAuthHandler`.
 */
export const captchaEndpointsFor = (isBypassed: boolean): string[] =>
  isBypassed ? [CAPTCHA_BYPASS_ENDPOINT] : [...CAPTCHA_ENDPOINTS];
