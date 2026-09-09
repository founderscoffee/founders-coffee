import { z } from 'zod';

const REDIRECT_ORIGIN = 'https://founders.coffee';

/**
 * A path this site may send a browser to after authentication.
 *
 * Both ends are checked, because passing the first does not imply passing the second. The input
 * must be a relative path that resolves to our own origin, which rejects `//host`, `\\host` and
 * absolute URLs. The *output* must then still be a single-slash path: URL parsing collapses `..`,
 * so `/..//attacker.example` resolves to our origin while its pathname is `//attacker.example` — a
 * protocol-relative URL that a browser reads as a different site. Checking only the input let that
 * through as a working open redirect, since `LoginPage` assigns the result to `location.href`.
 */

export const sameOriginPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_048)
  .refine((value) => {
    try {
      const parsed = new URL(value, REDIRECT_ORIGIN);
      return value.startsWith('/') && parsed.origin === REDIRECT_ORIGIN;
    } catch {
      return false;
    }
  })
  .transform((value) => {
    const parsed = new URL(value, REDIRECT_ORIGIN);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  })
  .refine((path) => path.startsWith('/') && !path.startsWith('//'));

export const safeRedirectPath = (value: unknown): string => {
  const parsed = sameOriginPathSchema.safeParse(value);
  return parsed.success ? parsed.data : '/';
};

export const onboardingRedirectPath = (redirect: unknown): string =>
  `/onboarding?redirect=${encodeURIComponent(safeAuthReturnPath(redirect))}`;

export const authReturnPathSchema = sameOriginPathSchema.refine((path) => {
  try {
    const pathname = decodeURIComponent(
      new URL(path, REDIRECT_ORIGIN).pathname,
    ).replace(/\/+$/, '');
    return !['/login', '/onboarding'].includes(pathname);
  } catch {
    return false;
  }
});

export const safeAuthReturnPath = (value: unknown): string => {
  const parsed = authReturnPathSchema.safeParse(value);
  return parsed.success ? parsed.data : '/';
};
