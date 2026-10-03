import { stripSearchParams } from '@tanstack/react-router';
import { z } from 'zod';

import { withoutLocale } from './locale-routing';
import { parseSearch } from './search-params';

const REDIRECT_ORIGIN = 'https://founders.coffee';

const HOME = '/';

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

export type SocialRedirect = {
  callbackURL: string;
  newUserCallbackURL?: string;
};

/**
 * A path on this site as the full address a Google or GitHub sign-in returns to.
 *
 * Better Auth accepts a relative `callbackURL` only when its path is plain ASCII (letters, digits
 * and `-._+/@`), and answers 403 "Invalid callbackURL" to any other. A meetup's address carries its
 * title, so an Arabic one is percent-encoded, and production refused every such sign-in started
 * from one (2026-10-02). A full address is checked by its origin alone, so the same path on the
 * page's own origin passes in any script. The path goes through `safeRedirectPath` first, so
 * nothing but a page on that origin comes out.
 */
export const socialCallbackUrl = (path: string, origin: string): string =>
  new URL(safeRedirectPath(path), origin).href;

/** Both return paths of a provider sign-in as `socialCallbackUrl` addresses on `origin`. */
export const socialCallbacks = (
  { callbackURL, newUserCallbackURL }: SocialRedirect,
  origin: string,
): SocialRedirect => ({
  callbackURL: socialCallbackUrl(callbackURL, origin),
  ...(newUserCallbackURL
    ? { newUserCallbackURL: socialCallbackUrl(newUserCallbackURL, origin) }
    : {}),
});

export const authReturnSearchSchema = z.object({
  redirect: authReturnPathSchema.catch(HOME).optional().default(HOME),
});

/**
 * Keep the default return path out of the address of every screen that reads
 * `authReturnSearchSchema`.
 *
 * `validateSearch` fills in `redirect: '/'` for an address that names none, and the server answers
 * an address whose query is not the one it would build with a redirect to the one it would. So
 * `/en/login` answered 307 to `/en/login?redirect=%2F`, and `/login` took two hops to land (#117).
 * With the default left out, the bare address is already the one the router builds.
 */
export const withoutDefaultReturnPath = () =>
  stripSearchParams<z.output<typeof authReturnSearchSchema>>({
    redirect: HOME,
  });

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
