import { describe, expect, it } from 'vitest';

import {
  PRODUCTION_ORIGIN,
  isIndexableEnvironment,
  robotsBody,
  robotsBodyForOrigin,
  siteOriginFromEnv,
  shouldNoIndexEnvironment,
  withIndexationHeaders,
} from './indexation';

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
      'User-agent: *\nAllow: /\n',
    );
    expect(robotsBody({ APP_ENVIRONMENT: 'staging' })).toBe(
      'User-agent: *\nDisallow: /\n',
    );
    expect(robotsBodyForOrigin(PRODUCTION_ORIGIN)).toBe(
      'User-agent: *\nAllow: /\n',
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
});
