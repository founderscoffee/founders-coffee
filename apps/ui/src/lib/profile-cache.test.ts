import { describe, expect, it } from 'vitest';

import {
  PRIVATE_SCREENS_IN_EVERY_LANGUAGE,
  PRIVATE_SCREEN_STUBS,
  PRIVATE_SCREEN_VARIANTS,
  PUBLIC_PAGES_NAMING_A_SCREEN,
} from './private-screens.fixtures';
import {
  isPrivateProfilePath,
  purgePrivateCacheEntries,
} from './profile-cache';
import { safeAuthReturnPath, onboardingRedirectPath } from './redirect';

describe('profile navigation privacy', () => {
  it.each(PRIVATE_SCREENS_IN_EVERY_LANGUAGE)(
    'keeps %s, a private screen in its language, out of the service-worker cache',
    (path) => {
      expect(isPrivateProfilePath(path)).toBe(true);
    },
  );
  it.each([
    ...PRIVATE_SCREEN_STUBS,
    ...PRIVATE_SCREEN_VARIANTS,
    '/profile/',
    '/en/profile/',
  ])(
    'keeps %s out as well, which the router still answers with a private screen',
    (path) => {
      expect(isPrivateProfilePath(path)).toBe(true);
    },
  );
  it.each([
    '/_serverFn/123',
    '/api/auth/get-session',
    '/%5FserverFn/123',
    '/%5fserverFn/123',
    '//_serverFn/123',
    '//api/auth/get-session',
  ])('excludes %s from service-worker caching', (path) => {
    expect(isPrivateProfilePath(path)).toBe(true);
  });
  it.each([
    ['/%zz', false],
    ['/en/%E0', false],
    ['/en/%70rofile/%zz', true],
  ])(
    'reads the malformed %s without throwing, as the router reads it',
    (path, isPrivate) => {
      expect(isPrivateProfilePath(path)).toBe(isPrivate);
    },
  );
  it.each([
    ...PUBLIC_PAGES_NAMING_A_SCREEN,
    '/algeria/e/closeout',
    '/',
    '/algeria',
    '/ar/algeria',
    '/fr/algeria/e/coffee-code',
    '/assets/profile.js',
    '/unrelated',
    '/profiles',
    '/activities',
  ])('lets the service worker keep %s, which is no private screen', (path) => {
    expect(isPrivateProfilePath(path)).toBe(false);
  });
  it.each([
    '/login?redirect=/login',
    '/onboarding/',
    '/ar/login',
    '/fr/login?redirect=/fr/login',
    '/en/onboarding/',
    '/%6cogin',
    '/%zz',
    '//evil.test',
    '/..//evil.test',
    'https://evil.test',
  ])('rejects unsafe or looping auth return %s', (path) => {
    expect(safeAuthReturnPath(path)).toBe('/');
    expect(onboardingRedirectPath('ar', path)).toBe(
      '/ar/onboarding?redirect=%2F',
    );
  });
  it('sweeps only the private paths when the service worker activates', async () => {
    const privatePages = [
      '/profile',
      '/en/%75/usr_1',
      ...PRIVATE_SCREENS_IN_EVERY_LANGUAGE,
    ];
    const deleted: string[] = [];
    const cache = {
      keys: () =>
        Promise.resolve(
          [
            ...privatePages,
            '/algeria/e/coffee-code',
            ...PUBLIC_PAGES_NAMING_A_SCREEN,
          ].map((path) => new Request(`https://founders.coffee${path}`)),
        ),
      match: () => Promise.resolve(undefined),
      delete: (request: Request) => {
        deleted.push(new URL(request.url).pathname);
        return Promise.resolve(true);
      },
    };
    const storage = {
      keys: () => Promise.resolve(['pages']),
      open: () => Promise.resolve(cache),
    } as unknown as CacheStorage;

    await purgePrivateCacheEntries(storage);

    expect(deleted).toEqual(privatePages);
  });

  it('preserves event and wizard return paths without submitting them', () => {
    const path = '/algeria/host/create?city=556#review';
    expect(safeAuthReturnPath(path)).toBe(path);
    expect(onboardingRedirectPath('ar', path)).toBe(
      `/ar/onboarding?redirect=${encodeURIComponent(path)}`,
    );
  });
});
