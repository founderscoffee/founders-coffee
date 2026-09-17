import { describe, expect, it } from 'vitest';

import {
  isPrivateProfilePath,
  purgePrivateCacheEntries,
} from './profile-cache';
import { safeAuthReturnPath, onboardingRedirectPath } from './redirect';

describe('profile navigation privacy', () => {
  it.each([
    '/profile',
    '/profile/',
    '/profile/activity',
    '/profile/notifications',
    '/profile/account',
    '/preferences',
    '/activity',
    '/account',
    '/onboarding',
    '/login',
    '/u/usr_123',
    '/_serverFn/123',
    '/api/auth/get-session',
  ])('excludes %s from service-worker caching', (path) => {
    expect(isPrivateProfilePath(path)).toBe(true);
  });
  it.each([
    '/',
    '/algeria',
    '/assets/profile.js',
    '/unrelated',
    '/profiles',
    '/activities',
  ])('keeps unrelated paths %s unchanged', (path) => {
    expect(isPrivateProfilePath(path)).toBe(false);
  });
  it.each([
    '/login?redirect=/login',
    '/onboarding/',
    '/%6cogin',
    '/%zz',
    '//evil.test',
    '/..//evil.test',
    'https://evil.test',
  ])('rejects unsafe or looping auth return %s', (path) => {
    expect(safeAuthReturnPath(path)).toBe('/');
    expect(onboardingRedirectPath(path)).toBe('/onboarding?redirect=%2F');
  });
  it('sweeps only the private paths when the service worker activates', async () => {
    const deleted: string[] = [];
    const cache = {
      keys: () =>
        Promise.resolve(
          ['/profile', '/algeria/e/coffee-code'].map(
            (path) => new Request(`https://founders.coffee${path}`),
          ),
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

    expect(deleted).toEqual(['/profile']);
  });

  it('preserves event and wizard return paths without submitting them', () => {
    const path = '/algeria/host/create?city=556#review';
    expect(safeAuthReturnPath(path)).toBe(path);
    expect(onboardingRedirectPath(path)).toBe(
      `/onboarding?redirect=${encodeURIComponent(path)}`,
    );
  });
});
