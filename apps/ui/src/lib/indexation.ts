export type IndexationEnvironment = {
  readonly APP_URL?: string;
  readonly APP_ENVIRONMENT?: string;
};

export const PRODUCTION_ORIGIN = 'https://founders.coffee';
export const NO_INDEX_VALUE = 'noindex, nofollow';
export const PUBLIC_DOCUMENT_CACHE_CONTROL =
  'public, max-age=0, s-maxage=60, stale-while-revalidate=300';
export const PRIVATE_DOCUMENT_CACHE_CONTROL = 'private, no-store';

const parseOrigin = (value: string | undefined): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    const isLocal =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !isLocal) return null;
    return url.origin;
  } catch {
    return null;
  }
};

export const siteOriginFromEnv = (
  env: IndexationEnvironment,
  requestOrigin?: string,
): string =>
  parseOrigin(env.APP_URL) ?? parseOrigin(requestOrigin) ?? PRODUCTION_ORIGIN;

export const isIndexableEnvironment = (env: IndexationEnvironment): boolean =>
  env.APP_ENVIRONMENT === 'production';

export const shouldNoIndexEnvironment = (env: IndexationEnvironment): boolean =>
  !isIndexableEnvironment(env);

export const withIndexationHeaders = (
  response: Response,
  env: IndexationEnvironment,
): Response => {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (
    !shouldNoIndexEnvironment(env) ||
    response.status === 101 ||
    !contentType.includes('text/html')
  )
    return response;

  const headers = new Headers(response.headers);
  headers.set('X-Robots-Tag', NO_INDEX_VALUE);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const PRIVATE_SCREEN =
  /^\/(?:[^/]+\/)?(?:closeout|edit|feedback|login|onboarding|profile|u\/[^/]+)(?:\/|$)/iu;
const LEGACY_PRIVATE_ADDRESS = /^\/(?:account|activity|preferences)(?:\/|$)/iu;
const HOST_WIZARD = /^\/(?:[^/]+\/){1,2}host\/create(?:\/|$)/iu;

const tryDecodeURI = (text: string): string | undefined => {
  try {
    return decodeURI(text);
  } catch {
    return undefined;
  }
};

const decodeEscapes = (path: string): string =>
  tryDecodeURI(path) ??
  path.replace(/%[0-9a-f]{2}/giu, (escape) => tryDecodeURI(escape) ?? escape);

/**
 * The path TanStack Start routes an address by, which is not always the path the address spells.
 *
 * Start decodes percent-escapes before the router matches a route or a server function is looked
 * up, so `/en/%70rofile` is the profile screen and `/%5FserverFn/{id}` a server-function call. It
 * decodes as `decodeURI` does (router-core's `decodePath`), which leaves an escaped slash where it
 * is: `/a%2Fb/profile` is one segment of noise in front of the profile screen, which the `$locale`
 * layout forwards there, and not `/a/b/profile`, where the name sits too deep to count. A malformed
 * escape does not throw: as in router-core, the escapes that decode on their own are decoded and
 * the rest are kept.
 *
 * Repeated slashes collapse, because Start answers `//profile` with a redirect to `/profile` and the
 * router answers `/en//profile` with one to `/en/profile`. Trailing spaces go, because Start parses
 * the decoded path as a URL again, which trims them, so `/en/login%20` is the sign-in screen.
 *
 * router-core also leaves `%25` and `%5C` escaped. It decodes twice and parses in between, where a
 * decoded `%` would start a second escape and a decoded `\` would become a slash. Decoded once and
 * split on `/` alone, neither can change a segment here.
 */
export const routedPath = (pathname: string): string =>
  decodeEscapes(pathname)
    .replace(/\/{2,}/gu, '/')
    .replace(/ +$/u, '');

/**
 * Whether an address leads to a private screen, in any form the router answers it in.
 *
 * A screen is reached three ways: behind a language (`/en/profile`, whose guard sends a signed-out
 * reader to sign in), by its bare name (`/profile`, kept for links already sent), and behind any
 * other segment, which the `$locale` layout drops (`/algeria/profile`). The last two take their
 * target from the reader's cookie.
 *
 * So the name counts first or second, never deeper: `/en/algeria/e/feedback` is a meetup whose slug
 * happens to name a screen, and it has to stay public. The legacy addresses only ever existed bare,
 * and the host wizard sits under a market. Case is ignored because the router ignores it, so
 * `/en/PROFILE` is the profile screen. The address is read as the router reads it, through
 * {@link routedPath}, so `/en/%70rofile` and `/en//profile` are the profile screen too.
 *
 * This is the one list of private screens. The Worker's header floor, the service worker's cache and
 * the Early Hints policy all read it, so a screen is private to all three or to none. Each of them
 * used to keep a list of its own, and when the screens moved under a language all three went on
 * naming the addresses they had left.
 */
export const isPrivatePath = (pathname: string): boolean => {
  const path = routedPath(pathname);
  return (
    PRIVATE_SCREEN.test(path) ||
    LEGACY_PRIVATE_ADDRESS.test(path) ||
    HOST_WIZARD.test(path)
  );
};

/**
 * Mark a response on the way to a private screen `private, no-store` and `noindex`.
 *
 * A route's own `headers()` reach only a page it renders. TanStack Start returns a redirect before
 * it reads them, so every redirect on the way to a private screen carries what this adds and
 * nothing else.
 */
export const withPrivateRouteHeaders = (
  response: Response,
  pathname: string,
): Response => {
  if (!isPrivatePath(pathname)) return response;
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', PRIVATE_DOCUMENT_CACHE_CONTROL);
  headers.set('X-Robots-Tag', NO_INDEX_VALUE);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export const robotsBody = (env: IndexationEnvironment): string =>
  isIndexableEnvironment(env)
    ? `User-agent: *\nAllow: /\nSitemap: ${PRODUCTION_ORIGIN}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';

export const robotsBodyForOrigin = (origin: string): string =>
  robotsBody({
    APP_ENVIRONMENT: origin === PRODUCTION_ORIGIN ? 'production' : 'staging',
  });
