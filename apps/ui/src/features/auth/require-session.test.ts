import { isRedirect } from '@tanstack/react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { redirectWhenSignedIn, requireSession } from './require-session';

const state = vi.hoisted(() => ({ hasSession: false }));

vi.mock('./api', () => ({
  authApi: { hasAuthSession: () => Promise.resolve(state.hasSession) },
}));

type RedirectOptions = {
  to?: string;
  href?: string;
  search?: { redirect?: string };
};

const redirectFrom = async (path: string): Promise<RedirectOptions> => {
  try {
    await requireSession(path);
  } catch (thrown) {
    if (!isRedirect(thrown)) throw thrown;
    return (thrown as unknown as { options: RedirectOptions }).options;
  }
  throw new Error(`requireSession('${path}') let an anonymous visitor through`);
};

const destinationFrom = async (path: string): Promise<string> => {
  try {
    await redirectWhenSignedIn(path);
  } catch (thrown) {
    if (!isRedirect(thrown)) throw thrown;
    return (
      (thrown as unknown as { options: RedirectOptions }).options.href ?? ''
    );
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
    await expect(requireSession('/profile')).resolves.toBeUndefined();
  });

  it('sends a signed-out visitor to sign in, and back again afterwards', async () => {
    const options = await redirectFrom('/profile/account');
    expect(options.to).toBe('/login');
    expect(options.search?.redirect).toBe('/profile/account');
  });

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
