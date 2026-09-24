import { isRedirect } from '@tanstack/react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Locale } from '@founders-coffee/i18n';

import { stringifySearch } from '../../lib/search-params';
import { redirectWhenSignedIn, requireSession } from './require-session';

const state = vi.hoisted(() => ({ hasSession: false }));

vi.mock('./api', () => ({
  authApi: { hasAuthSession: () => Promise.resolve(state.hasSession) },
}));

type RedirectOptions = {
  to?: string;
  params?: { locale?: string };
  search?: Record<string, string>;
  hash?: string;
};

const redirectFrom = async (
  path: string,
  locale: Locale = 'ar',
): Promise<RedirectOptions> => {
  try {
    await requireSession(locale, path);
  } catch (thrown) {
    if (!isRedirect(thrown)) throw thrown;
    return (thrown as unknown as { options: RedirectOptions }).options;
  }
  throw new Error(`requireSession('${path}') let an anonymous visitor through`);
};

/**
 * Where the guard sends a signed-in visitor, written out as the address the router builds from it.
 */
const destinationFrom = async (path: string): Promise<string> => {
  try {
    await redirectWhenSignedIn(path);
  } catch (thrown) {
    if (!isRedirect(thrown)) throw thrown;
    const {
      to = '',
      search = {},
      hash = '',
    } = (thrown as unknown as { options: RedirectOptions }).options;
    return `${to}${stringifySearch(search)}${hash === '' ? '' : `#${hash}`}`;
  }
  throw new Error(
    `redirectWhenSignedIn('${path}') left a signed-in visitor on the sign-in page`,
  );
};

afterEach(() => {
  state.hasSession = false;
});

describe('requiring a session before a private page renders', () => {
  it('lets a signed-in visitor through', async () => {
    state.hasSession = true;
    await expect(requireSession('ar', '/profile')).resolves.toBeUndefined();
  });

  it.each(['ar', 'en', 'fr'] as const)(
    'sends a signed-out %s reader to sign in, and back again afterwards',
    async (locale) => {
      const options = await redirectFrom('/profile/account', locale);
      expect(options.to).toBe('/$locale/login');
      expect(
        options.params?.locale,
        'they sign in in the language they were reading, not the default one',
      ).toBe(locale);
      expect(options.search?.redirect).toBe('/profile/account');
    },
  );

  it('keeps the query string, which is where a tab selection lives', async () => {
    const options = await redirectFrom('/profile/activity?tab=past');
    expect(options.search?.redirect).toBe('/profile/activity?tab=past');
  });

  it.each([
    '//evil.example/profile',
    'https://evil.example/profile',
    '/..//evil.example',
  ])('refuses to hand the visitor %s as a destination', async (path) => {
    expect((await redirectFrom(path)).search?.redirect).toBe('/');
  });

  it.each(['/login', '/onboarding'])(
    'does not send the visitor back to %s, which would loop',
    async (path) => {
      expect((await redirectFrom(path)).search?.redirect).toBe('/');
    },
  );
});

describe('keeping a signed-in visitor off the sign-in page', () => {
  it('leaves an anonymous visitor on it, which is who it is for', async () => {
    await expect(redirectWhenSignedIn('/profile')).resolves.toBeUndefined();
  });

  it('sends a signed-in visitor where they were headed', async () => {
    state.hasSession = true;
    expect(await destinationFrom('/profile/account')).toBe('/profile/account');
  });

  it('keeps the query string on the way', async () => {
    state.hasSession = true;
    expect(await destinationFrom('/profile/activity?tab=past')).toBe(
      '/profile/activity?tab=past',
    );
  });

  it('falls back home when no destination was named', async () => {
    state.hasSession = true;
    expect(await destinationFrom('/')).toBe('/');
  });

  it.each([
    '//evil.example/profile',
    'https://evil.example/profile',
    '/..//evil.example',
  ])('refuses to forward a signed-in visitor to %s', async (path) => {
    state.hasSession = true;
    expect(
      await destinationFrom(path),
      'the sign-in page takes its destination from the query string, so an unchecked one here is an open redirect that fires without the reader touching anything',
    ).toBe('/');
  });

  it('does not forward to /login, which would bounce forever', async () => {
    state.hasSession = true;
    expect(
      await destinationFrom('/login'),
      'this guard sends readers away from /login, so forwarding one back to it re-enters the guard',
    ).toBe('/');
  });
});
