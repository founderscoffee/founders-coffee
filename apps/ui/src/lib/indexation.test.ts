import { getNormalizedURL } from '@tanstack/react-router/ssr/server';
import { describe, expect, it } from 'vitest';

import { LOCALES } from '@founders-coffee/i18n';

import {
  PRODUCTION_ORIGIN,
  isIndexableEnvironment,
  robotsBody,
  robotsBodyForOrigin,
  siteOriginFromEnv,
  shouldNoIndexEnvironment,
  withIndexationHeaders,
  withPrivateRouteHeaders,
} from './indexation';
import {
  PRIVATE_SCREENS_IN_EVERY_LANGUAGE,
  PRIVATE_SCREEN_STUBS,
  PRIVATE_SCREEN_VARIANTS,
  PUBLIC_PAGES_NAMING_A_SCREEN,
} from './private-screens.fixtures';
import { declaredRoutes, sourceOf } from './route-contract.fixtures';

const PRIVATE = ['private, no-store', 'noindex, nofollow'];
const UNTOUCHED = [null, null];

const floorAt = (pathname: string): (string | null)[] => {
  const response = withPrivateRouteHeaders(
    new Response(null, { status: 307, headers: { location: '/elsewhere' } }),
    pathname,
  );
  return [
    response.headers.get('cache-control'),
    response.headers.get('x-robots-tag'),
  ];
};

describe('indexation policy', () => {
  it('uses the configured origin and strips paths', () => {
    expect(
      siteOriginFromEnv({ APP_URL: 'https://staging.founders.coffee/app' }),
    ).toBe('https://staging.founders.coffee');
    expect(siteOriginFromEnv({ APP_URL: 'http://localhost:3000' })).toBe(
      'http://localhost:3000',
    );
  });

  it('falls back safely when the origin is missing or unsafe', () => {
    expect(siteOriginFromEnv({})).toBe(PRODUCTION_ORIGIN);
    expect(siteOriginFromEnv({ APP_URL: 'http://example.com' })).toBe(
      PRODUCTION_ORIGIN,
    );
    expect(siteOriginFromEnv({ APP_URL: 'not an url' })).toBe(
      PRODUCTION_ORIGIN,
    );
    expect(
      siteOriginFromEnv(
        { APP_ENVIRONMENT: 'staging', APP_URL: 'not an url' },
        'https://staging.founders.coffee',
      ),
    ).toBe('https://staging.founders.coffee');
  });

  it('only treats an explicit production environment as indexable', () => {
    expect(isIndexableEnvironment({ APP_ENVIRONMENT: 'production' })).toBe(
      true,
    );
    expect(isIndexableEnvironment({ APP_ENVIRONMENT: 'staging' })).toBe(false);
    expect(shouldNoIndexEnvironment({ APP_ENVIRONMENT: 'development' })).toBe(
      true,
    );
    expect(shouldNoIndexEnvironment({})).toBe(true);
  });

  it('returns an allow-all production robots policy and blocks other environments', () => {
    expect(robotsBody({ APP_ENVIRONMENT: 'production' })).toBe(
      'User-agent: *\nAllow: /\nSitemap: https://founders.coffee/sitemap.xml\n',
    );
    expect(robotsBody({ APP_ENVIRONMENT: 'staging' })).toBe(
      'User-agent: *\nDisallow: /\n',
    );
    expect(robotsBodyForOrigin(PRODUCTION_ORIGIN)).toBe(
      'User-agent: *\nAllow: /\nSitemap: https://founders.coffee/sitemap.xml\n',
    );
    expect(robotsBodyForOrigin('https://staging.founders.coffee')).toBe(
      'User-agent: *\nDisallow: /\n',
    );
  });

  it('adds noindex only to non-production HTML responses', async () => {
    const staging = withIndexationHeaders(
      new Response('<html />', { headers: { 'content-type': 'text/html' } }),
      { APP_ENVIRONMENT: 'staging' },
    );
    expect(staging.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(await staging.text()).toBe('<html />');

    const production = withIndexationHeaders(
      new Response('<html />', { headers: { 'content-type': 'text/html' } }),
      { APP_ENVIRONMENT: 'production' },
    );
    expect(production.headers.get('x-robots-tag')).toBeNull();

    const stagingJson = withIndexationHeaders(
      new Response('{}', { headers: { 'content-type': 'application/json' } }),
      { APP_ENVIRONMENT: 'staging' },
    );
    expect(stagingJson.headers.get('x-robots-tag')).toBeNull();
  });

  it('keeps private route redirects private and noindex', () => {
    const response = withPrivateRouteHeaders(
      new Response(null, { status: 307, headers: { location: '/login' } }),
      '/login',
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(response.headers.get('location')).toBe('/login');

    const publicResponse = withPrivateRouteHeaders(
      new Response('<html />'),
      '/ar/algeria',
    );
    expect(publicResponse.headers.get('cache-control')).toBeNull();
    expect(publicResponse.headers.get('x-robots-tag')).toBeNull();
  });
});

describe('the private-route floor', () => {
  it.each(PRIVATE_SCREENS_IN_EVERY_LANGUAGE)(
    'keeps %s, a private screen in its language, private',
    (path) => {
      expect(floorAt(path)).toEqual(PRIVATE);
    },
  );

  it.each(PRIVATE_SCREEN_STUBS)(
    'keeps the stub %s private, because its target follows the cookie',
    (path) => {
      expect(floorAt(path)).toEqual(PRIVATE);
    },
  );

  it.each(PRIVATE_SCREEN_VARIANTS)(
    'keeps %s private, which the router still answers with a private screen',
    (path) => {
      expect(floorAt(path)).toEqual(PRIVATE);
    },
  );

  it.each([
    ...PUBLIC_PAGES_NAMING_A_SCREEN,
    '/',
    '/ar',
    '/ar/algeria',
    '/en/algeria/algiers',
    '/fr/algeria/e/coffee-code',
    '/algeria/e/closeout',
    '/fr/about',
    '/ar/privacy',
    '/algeria',
    '/about',
    '/sitemap.xml',
    '/og/e/evt_1',
    '/cal/e/evt_1',
  ])('leaves the public %s alone', (path) => {
    expect(floorAt(path)).toEqual(UNTOUCHED);
  });

  it.each(['/en%2Fprofile', '/en/profile%2Faccount', '/en/%2570rofile'])(
    'leaves %s alone, whose escapes the router does not turn into a screen',
    (path) => {
      expect(floorAt(path)).toEqual(UNTOUCHED);
    },
  );

  it.each([
    ['/%zz', UNTOUCHED],
    ['/en/%E0', UNTOUCHED],
    ['/en/%zz/%70rofile', UNTOUCHED],
    ['/en/%70rofile/%zz', PRIVATE],
    ['/%E0/%6C%6F%67%69%6E', PRIVATE],
  ])(
    'reads the malformed %s without throwing, decoding each escape that stands on its own',
    (path, headers) => {
      expect(floorAt(path)).toEqual(headers);
    },
  );

  it('reaches every route that stamps its own pages noindex, in every language', () => {
    const selfStamped = declaredRoutes().filter(({ file }) =>
      sourceOf(file).includes("'X-Robots-Tag': NO_INDEX_VALUE"),
    );
    expect(
      selfStamped.length,
      'no route parsed as stamping itself, so the loop below is vacuous',
    ).toBeGreaterThan(8);

    for (const { fullPath } of selfStamped)
      for (const locale of LOCALES) {
        const path = fullPath
          .replace('$locale', locale)
          .replace(/\$\w+/gu, 'x');
        expect(
          floorAt(path),
          `${fullPath} stamps the pages it renders, but a redirect leaves before it can, so ${path} has only this floor`,
        ).toEqual(PRIVATE);
      }
  });
});

describe('the address the floor reads', () => {
  it.each([
    ...PRIVATE_SCREENS_IN_EVERY_LANGUAGE,
    ...PRIVATE_SCREEN_STUBS,
    ...PRIVATE_SCREEN_VARIANTS,
    ...PUBLIC_PAGES_NAMING_A_SCREEN,
    '/en%2Fprofile',
    '/en/profile%2Faccount',
    '/en/%2570rofile',
    '/en/%5Cprofile',
    '/en/%20profile',
    '/en/%0Alogin',
    '/en/%70rofile/%zz',
    '/%E0/%6C%6F%67%69%6E',
  ])('is %s as TanStack Start hands it to the router', (path) => {
    const { url } = getNormalizedURL(`${PRODUCTION_ORIGIN}${path}`);
    expect(
      floorAt(path),
      `Start routes ${path} as ${url.pathname}, and a redirect it sends from there has only this floor`,
    ).toEqual(floorAt(url.pathname));
  });
});
