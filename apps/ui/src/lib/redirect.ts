import { z } from 'zod';

import type { Locale } from '@founders-coffee/i18n';

import { withoutLocale } from './locale-routing';
import { parseSearch } from './search-params';

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

export const onboardingRedirectPath = (
  locale: Locale,
  redirect: unknown,
): string =>
  `/${locale}/onboarding?redirect=${encodeURIComponent(safeAuthReturnPath(redirect))}`;

const AUTH_PAGES = ['/login', '/onboarding'];

export const authReturnPathSchema = sameOriginPathSchema.refine((path) => {
  try {
    const pathname = decodeURIComponent(
      new URL(path, REDIRECT_ORIGIN).pathname,
    ).replace(/\/+$/, '');
    return !AUTH_PAGES.includes(withoutLocale(pathname));
  } catch {
    return false;
  }
});

export const safeAuthReturnPath = (value: unknown): string => {
  const parsed = authReturnPathSchema.safeParse(value);
  return parsed.success ? parsed.data : '/';
};

/**
 * A path on this site as the options a navigation is built from, for a redirect to throw.
 *
 * `redirect({ href })` reaches the right page when it is navigated, but not when it is preloaded.
 * router-core's `preloadRoute` follows a redirect by preloading its options, and `buildLocation`
 * does not read `href`, so it rebuilt the page the redirect came from, query dropped, and that
 * page's guard threw the same redirect again for as long as the tab stayed open: one hover over
 * the sign-in link, with a session the tab had not noticed yet, made 429 session checks in four
 * seconds. A navigation reads an `href` by splitting it into a pathname, a query parsed by the
 * router's own `parseSearch`, and a fragment. This is that split, made before the redirect is
 * thrown, so a preload arrives where a navigation does.
 */
export const pathDestination = (path: string) => {
  const url = new URL(path, REDIRECT_ORIGIN);
  return {
    to: url.pathname,
    search: parseSearch(url.search),
    hash: url.hash.slice(1),
  };
};
