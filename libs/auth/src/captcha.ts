export const CAPTCHA_ENDPOINTS = [
  '/email-otp/send-verification-otp',
  '/phone-number/send-otp',
  '/phone-number/request-password-reset',
] as const;

/** True when the request targets a gated endpoint. Only POST bodies reach these paths. */
export const isCaptchaGated = (pathname: string, method: string): boolean =>
  method === 'POST' &&
  CAPTCHA_ENDPOINTS.some((endpoint) => pathname.includes(endpoint));

export const CAPTCHA_BYPASS_ENDPOINT = '/__turnstile-disabled__';

/**
 * The endpoint list to hand the plugin. `isBypassed` must come from an explicit
 * `TURNSTILE_DISABLED=true`; a merely missing secret key is a misconfiguration, not a bypass, and is
 * refused by `createAuthHandler`.
 */
export const captchaEndpointsFor = (isBypassed: boolean): string[] =>
  isBypassed ? [CAPTCHA_BYPASS_ENDPOINT] : [...CAPTCHA_ENDPOINTS];
