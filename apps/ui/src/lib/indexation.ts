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
 * `/en/PROFILE` is the profile screen.
 *
 * This is the one list of private screens. The Worker's header floor, the service worker's cache and
 * the Early Hints policy all read it, so a screen is private to all three or to none. Each of them
 * used to keep a list of its own, and when the screens moved under a language all three went on
 * naming the addresses they had left.
 */
export const isPrivatePath = (pathname: string): boolean =>
  PRIVATE_SCREEN.test(pathname) ||
  LEGACY_PRIVATE_ADDRESS.test(pathname) ||
  HOST_WIZARD.test(pathname);

/**
 * Mark a response on the way to a private screen `private, no-store` and `noindex`.
 *
 * A route's own `headers()` reach only a page it renders. TanStack Start returns a redirect before
 * it reads them, so every 307 on the way to a private screen carries what this adds and nothing
 * else.
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
