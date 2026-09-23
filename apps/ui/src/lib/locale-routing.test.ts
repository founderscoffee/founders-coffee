import { describe, expect, it } from 'vitest';

import {
  localizedEvent,
  localizedHome,
  localizedProfile,
  localizedHostCreate,
  localizedLanding,
  withLocale,
} from './locale-routing';

describe('switching the language of the page in view', () => {
  it.each([
    ['/ar/algeria', 'fr', '/fr/algeria'],
    ['/ar/algeria/algiers', 'en', '/en/algeria/algiers'],
    ['/ar/algeria/e/coffee-and-code', 'fr', '/fr/algeria/e/coffee-and-code'],
    ['/ar/terms/', 'en', '/en/terms/'],
    ['/ar', 'fr', '/fr'],
  ] as const)('rewrites %s to %s', (path, locale, expected) => {
    expect(withLocale(path, locale)).toBe(expected);
  });

  it.each([
    '/',
    '/login',
    '/profile/activity',
    '/algeria',
    '/algeria/host/create',
  ])('leaves %s alone, because it has no prefix to rewrite', (path) => {
    expect(withLocale(path, 'fr')).toBe(path);
  });

  it('leaves a two-letter segment that is not one of our locales where it is', () => {
    expect(withLocale('/de/algeria', 'fr')).toBe('/de/algeria');
  });
});

describe('addressing a page in the language the reader is in', () => {
  it('puts the locale where the router expects it, which is the market slot', () => {
    expect(localizedLanding('fr', 'algeria')).toMatchObject({
      to: '/$market/$city',
      params: { market: 'fr', city: 'algeria' },
    });
  });

  it('addresses a company page through the same route as a market', () => {
    expect(localizedLanding('ar', 'terms').params).toEqual({
      market: 'ar',
      city: 'terms',
    });
  });

  it('pushes the market down a level for the host wizard too', () => {
    expect(localizedHostCreate('fr', 'algeria')).toEqual({
      to: '/$market/$city/host/create',
      params: { market: 'fr', city: 'algeria' },
    });
  });

  it('pushes the market down a level for an event', () => {
    expect(localizedEvent('en', 'algeria', 'coffee-and-code')).toEqual({
      to: '/$market/$city/e/$slug',
      params: { market: 'en', city: 'algeria', slug: 'coffee-and-code' },
    });
  });
});

describe('localizedHome', () => {
  it('sends a brand mark straight at the market landing', () => {
    expect(localizedHome('fr', 'algeria')).toMatchObject({
      to: '/$market/$city',
      params: { market: 'fr', city: 'algeria' },
    });
  });

  it('falls back to the redirect stub only when no market is known', () => {
    expect(
      localizedHome('fr', undefined),
      'without a market there is nothing to name, and that is the one case where the redirect earns its geo lookup',
    ).toEqual({ to: '/' });
  });
});

describe('which link tells a screen reader it is the page being read', () => {
  it.each([
    ['a market landing', localizedLanding('fr', 'algeria')],
    ['home', localizedHome('fr', 'algeria')],
    ['the reader\u2019s own profile', localizedProfile('fr')],
  ])('marks %s current only on its own address', (_name, target) => {
    expect(
      (target as { activeOptions?: { exact?: boolean } }).activeOptions?.exact,
      'a link is active by path prefix unless told otherwise, and each of these is the prefix of every page beneath it',
    ).toBe(true);
  });
});
