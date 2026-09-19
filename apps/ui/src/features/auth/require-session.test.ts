import { isRedirect } from '@tanstack/react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { requireSession } from './require-session';

const state = vi.hoisted(() => ({ hasSession: false }));

vi.mock('./api', () => ({
  authApi: { hasAuthSession: () => Promise.resolve(state.hasSession) },
}));

type RedirectOptions = { to?: string; search?: { redirect?: string } };

const redirectFrom = async (path: string): Promise<RedirectOptions> => {
  try {
    await requireSession(path);
  } catch (thrown) {
    if (!isRedirect(thrown)) throw thrown;
    return (thrown as unknown as { options: RedirectOptions }).options;
  }
  throw new Error(`requireSession('${path}') let an anonymous visitor through`);
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
