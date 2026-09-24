import { createAuth, DevEmailProvider } from '@founders-coffee/auth';
import { createDb, seed } from '@founders-coffee/db';
import { cookieName } from '@founders-coffee/i18n';
import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

import worker from '../src/server';

const ORIGIN = 'https://founders.coffee';
const EVENT = 'evt_private_screen';
const SCREENS = ['closeout', 'feedback'];

const fetchDocument = async (
  path: string,
  cookies: readonly string[] = [],
): Promise<Response> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(`${ORIGIN}${path}`, {
      headers: {
        accept: 'text/html',
        ...(cookies.length > 0 ? { cookie: cookies.join('; ') } : {}),
      },
      redirect: 'manual',
    }),
    env,
    context,
  );
  await waitOnExecutionContext(context);
  return response;
};

const localeCookie = (locale: string): string => `${cookieName}=${locale}`;

/**
 * Sign a member in through Better Auth itself, and return the cookies their browser would send.
 *
 * The session lands in the D1 the Worker reads and is signed with the secret it verifies against,
 * so the route guard accepts it exactly as it would a real sign-in. The code comes from the dev
 * provider because D1 only ever holds it hashed.
 */
const signIn = async (email: string): Promise<string> => {
  const emailProvider = new DevEmailProvider();
  const { auth } = createAuth(
    {
      DB: env.DB,
      BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
      APP_URL: env.APP_URL,
      TURNSTILE_DISABLED: 'true',
    },
    { emailProvider },
  );
  const post = (path: string, body: unknown): Promise<Response> =>
    auth.handler(
      new Request(`${env.APP_URL}/api/auth${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: env.APP_URL },
        body: JSON.stringify(body),
      }),
    );
  await post('/email-otp/send-verification-otp', { email, type: 'sign-in' });
  const response = await post('/sign-in/email-otp', {
    email,
    otp: emailProvider.sent[0]?.otp ?? '',
  });
  return response.headers
    .getSetCookie()
    .map((line) => line.split(';')[0])
    .join('; ');
};

let session = '';

beforeAll(async () => {
  await seed(createDb(env.DB));
  session = await signIn('private-screens@example.dz');
});

describe('a signed-out visitor at a screen a notification links at', () => {
  it.each(SCREENS)(
    'is sent from /%s to sign in before the screen renders anything',
    async (screen) => {
      const response = await fetchDocument(`/fr/${screen}/${EVENT}`, [
        localeCookie('ar'),
      ]);

      expect(
        response.status,
        'a 200 here is the loading branch rendered on the server, which the browser replaces with a sign-in button and React throws away as a hydration mismatch',
      ).toBe(307);
      expect(
        response.headers.get('location'),
        'they sign in in the language of the link, and come back to the screen it named',
      ).toBe(
        `/fr/login?redirect=${encodeURIComponent(`/fr/${screen}/${EVENT}`)}`,
      );
      expect(
        [
          response.headers.get('Cache-Control'),
          response.headers.get('X-Robots-Tag'),
        ],
        'the screen stamps only a page it renders, so this redirect has nothing but the private-route floor to keep it out of shared caches and the index',
      ).toEqual(['private, no-store', 'noindex, nofollow']);
    },
  );
});

describe('a signed-out visitor at a private screen spelled another way', () => {
  it.each([
    ['/en/%70rofile', 307, '/en/login?redirect=%2Fen%2Fprofile'],
    ['/%70rofile', 307, '/fr/profile'],
    [
      `/fr/%66eedback/${EVENT}`,
      307,
      `/fr/login?redirect=${encodeURIComponent(`/fr/feedback/${EVENT}`)}`,
    ],
    ['/en//profile', 307, '/en/profile'],
    ['//profile', 308, `${ORIGIN}/profile`],
    ['/en/login%20', 307, '/en/login?redirect=%2F'],
  ])(
    'is sent on from %s with the private-route floor',
    async (path, status, location) => {
      const response = await fetchDocument(path, [localeCookie('fr')]);

      expect(response.status).toBe(status);
      expect(
        response.headers.get('location'),
        'Start decodes and tidies an address before the router matches it, so this one leads to a private screen',
      ).toBe(location);
      expect(
        [
          response.headers.get('Cache-Control'),
          response.headers.get('X-Robots-Tag'),
        ],
        'a redirect carries none of the headers of the screen it leads to, so it is private only if the floor reads the address the way the router does',
      ).toEqual(['private, no-store', 'noindex, nofollow']);
    },
  );
});

describe('the screens a notification links at carry their own language', () => {
  it('has a member signed in to open the screens as', () => {
    expect(
      session,
      'without a session every screen below answers with a redirect to sign in, which reads as a broken guard rather than a broken sign-in',
    ).toContain('session_token=');
  });

  it.each(SCREENS)(
    'opens /%s in the language of the link, not of the cookie',
    async (screen) => {
      const response = await fetchDocument(`/fr/${screen}/${EVENT}`, [
        localeCookie('ar'),
        session,
      ]);

      expect(response.status, `/fr/${screen} should render`).toBe(200);
      expect(
        /<html[^>]*\blang="fr"/u.test(await response.text()),
        'the prefix has to win over the cookie, or a host prompted in French still lands in Arabic',
      ).toBe(true);
    },
  );

  it.each(SCREENS)(
    'sends the unprefixed /%s on to its prefixed form',
    async (screen) => {
      const response = await fetchDocument(`/${screen}/${EVENT}`, [
        localeCookie('fr'),
      ]);

      expect(response.status).toBe(307);
      expect(
        response.headers.get('location'),
        'notifications already in flight carry the unprefixed address and have to keep working',
      ).toBe(`/fr/${screen}/${EVENT}`);
    },
  );

  it.each(SCREENS)(
    'keeps /%s out of any shared cache and out of the index',
    async (screen) => {
      const response = await fetchDocument(`/fr/${screen}/${EVENT}`, [
        localeCookie('fr'),
        session,
      ]);

      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toContain('no-store');
      expect(response.headers.get('X-Robots-Tag')).toBeTruthy();
    },
  );
});
