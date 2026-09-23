import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import worker from '../src/server';

const ORIGIN = 'https://staging.founders.coffee';

const HOP_LIMIT = 5;

const fetchOnce = async (url: string, cookie?: string): Promise<Response> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(url, {
      headers: cookie
        ? { accept: 'text/html', cookie }
        : { accept: 'text/html' },
    }),
    env,
    context,
  );
  await waitOnExecutionContext(context);
  return response;
};

/**
 * Walk the redirects the way a browser does, and report where it came to rest.
 *
 * A prefixed address answers one hop before the page: `validateSearch` fills in the default
 * return path and sends the reader back with it. Reading only the first response mistakes that
 * housekeeping for the destination.
 */
const visit = async (
  pathname: string,
  cookie?: string,
): Promise<{ status: number; landed: string; lang: string | null }> => {
  let url = `${ORIGIN}${pathname}`;
  for (let hop = 0; hop < HOP_LIMIT; hop += 1) {
    const response = await fetchOnce(url, cookie);
    const location = response.headers.get('location');
    if (location === null) {
      const body = await response.text();
      return {
        status: response.status,
        landed: new URL(url).pathname + new URL(url).search,
        lang: /<html[^>]*lang="([^"]*)"/u.exec(body)?.[1] ?? null,
      };
    }
    url = new URL(location, ORIGIN).toString();
  }
  throw new Error(`${pathname} never stopped redirecting`);
};

describe('signing in, in the language the reader was reading', () => {
  it.each(['ar', 'en', 'fr'])(
    'serves /%s/login as its own page',
    async (locale) => {
      const page = await visit(`/${locale}/login`);

      expect(page.status, 'every prefixed form used to 404').toBe(200);
      expect(page.lang).toBe(locale);
    },
  );

  it.each([
    ['PARAGLIDE_LOCALE=fr', '/fr/login'],
    ['PARAGLIDE_LOCALE=en', '/en/login'],
    ['PARAGLIDE_LOCALE=ar', '/ar/login'],
  ])('hands the bare address under %s to %s', async (cookie, expected) => {
    const bare = await visit('/login', cookie);

    expect(bare.landed).toContain(expected);
    expect(bare.status).toBe(200);
  });

  it('carries the return path through the hand-off', async () => {
    const bare = await visit(
      '/login?redirect=%2Falgeria%2Fhost%2Fcreate',
      'PARAGLIDE_LOCALE=fr',
    );

    expect(
      bare.landed,
      'a reader sent to sign in from somewhere has to be sent back there',
    ).toContain('redirect=%2Falgeria%2Fhost%2Fcreate');
    expect(bare.landed).toContain('/fr/login');
  });

  it('sends a first segment that names no language to one that does', async () => {
    const wrong = await visit('/algeria/login', 'PARAGLIDE_LOCALE=fr');

    expect(wrong.landed).toContain('/fr/login');
  });
});

describe('reaching a private screen that needs a session', () => {
  it.each([
    ['/ar/profile', '/ar/login'],
    ['/fr/profile/activity', '/fr/login'],
    ['/en/profile/account', '/en/login'],
    ['/ar/profile/notifications', '/ar/login'],
  ])('sends %s to %s', async (pathname, expected) => {
    const page = await visit(pathname);

    expect(page.landed).toContain(expected);
    expect(
      page.landed,
      'they come back to the screen they asked for, still in its own language',
    ).toContain(encodeURIComponent(pathname));
  });

  it.each([
    ['/profile', '/fr/profile'],
    ['/profile/activity', '/fr/profile/activity'],
    ['/activity', '/fr/profile/activity'],
    ['/preferences', '/fr/profile/notifications'],
    ['/account', '/fr/profile/account'],
    ['/algeria/profile', '/fr/profile'],
    ['/algeria/profile/activity', '/fr/profile/activity'],
    ['/algeria/profile/notifications', '/fr/profile/notifications'],
    ['/algeria/profile/account', '/fr/profile/account'],
  ])('hands the bare %s on to %s', async (pathname, expected) => {
    const page = await visit(pathname, 'PARAGLIDE_LOCALE=fr');

    expect(page.landed).toContain(encodeURIComponent(expected));
  });
});
