export type IndexationEnvironment = {
  readonly APP_URL?: string;
  readonly APP_ENVIRONMENT?: string;
};

export const PRODUCTION_ORIGIN = 'https://founders.coffee';
export const NO_INDEX_VALUE = 'noindex, nofollow';

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

export const robotsBody = (env: IndexationEnvironment): string =>
  isIndexableEnvironment(env)
    ? `User-agent: *\nAllow: /\nSitemap: ${PRODUCTION_ORIGIN}/sitemap.xml\n`
    : 'User-agent: *\nDisallow: /\n';

export const robotsBodyForOrigin = (origin: string): string =>
  robotsBody({
    APP_ENVIRONMENT: origin === PRODUCTION_ORIGIN ? 'production' : 'staging',
  });
