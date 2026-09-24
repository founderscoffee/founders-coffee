import {
  createDb,
  eq,
  session as sessionTable,
  user as userTable,
} from '@founders-coffee/db';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { createAuth } from './auth.js';
import { getSession, requireRole } from './middleware.js';
import { DevEmailProvider } from './providers/email.js';
import { sessionTokenFromCookie } from './session-cookie.js';

const authEnv = {
  DB: env.DB,
  BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
  APP_URL: env.APP_URL,
  TURNSTILE_DISABLED: 'true',
};

const base = `${env.APP_URL}/api/auth`;

const post = (path: string, body: unknown, cookie?: string): Request => {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin: env.APP_URL,
  };
  if (cookie) headers.cookie = cookie;
  return new Request(`${base}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
};

const SESSION_COOKIE = '__Secure-better-auth.session_token';

const signIn = async (email: string) => {
  const emailProvider = new DevEmailProvider();
  const { auth } = createAuth(authEnv, { emailProvider });
  await auth.handler(
    post('/email-otp/send-verification-otp', { email, type: 'sign-in' }),
  );
  const response = await auth.handler(
    post('/sign-in/email-otp', {
      email,
      otp: emailProvider.sent[0]?.otp ?? '',
    }),
  );
  const setCookies = response.headers.getSetCookie();
  return {
    auth,
    response,
    browserCookie: setCookies.map((line) => line.split(';')[0]).join('; '),
    sessionCookie:
      setCookies.find((line) => line.startsWith(`${SESSION_COOKIE}=`)) ?? '',
  };
};

describe('libs/auth — passwordless email-OTP + phone-OTP (real D1 via Miniflare)', () => {
  it('auto-registers, verifies the email, and opens a session on OTP sign-in', async () => {
    const emailProvider = new DevEmailProvider();
    const { auth } = createAuth(authEnv, { emailProvider });
    const email = 'founder@example.dz';

    const sendRes = await auth.handler(
      post('/email-otp/send-verification-otp', { email, type: 'sign-in' }),
    );
    expect(sendRes.status).toBe(200);
    expect(emailProvider.sent).toHaveLength(1);
    const sent = emailProvider.sent[0];
    if (!sent) throw new Error('OTP was not sent');
    const otp = sent.otp;
    expect(otp).toHaveLength(6);

    const signInRes = await auth.handler(
      post('/sign-in/email-otp', { email, otp }),
    );
    expect(signInRes.status).toBe(200);
    const sessionCookie = (signInRes.headers.get('set-cookie') ?? '').split(
      ';',
    )[0];
    expect(sessionCookie).toContain('=');

    const db = createDb(env.DB);
    const users = await db
      .select()
      .from(userTable)
      .where(eq(userTable.email, email))
      .all();
    expect(users).toHaveLength(1);
    const created = users[0];
    if (!created) throw new Error('user was not created');
    expect(created.emailVerified).toBe(true);
    expect(created.role).toBe('member');

    const sessions = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.userId, created.id))
      .all();
    expect(sessions.length).toBeGreaterThanOrEqual(1);

    const session = await getSession(
      auth,
      new Headers({ cookie: sessionCookie }),
    );
    expect(session?.user.email).toBe(email);
    expect(session?.user.role).toBe('member');
    expect(session?.user.name).toBe('');
    for (const key of ['homeMarketCode', 'homeState', 'homeCityId']) {
      expect(session?.user).not.toHaveProperty(key);
    }
    expect(() => requireRole(session, 'member')).not.toThrow();
    expect(() => requireRole(session, 'admin')).toThrow();
    const updateResponse = await auth.handler(
      post(
        '/update-user',
        { name: 'Bypassed', image: 'https://example.com/photo' },
        sessionCookie,
      ),
    );
    expect(updateResponse.status).toBe(403);
    expect(await updateResponse.json()).toMatchObject({
      code: 'PROFILE_ENDPOINT_REQUIRED',
    });
    expect(
      (await getSession(auth, new Headers({ cookie: sessionCookie })))?.user
        .name,
    ).toBe('');
    await expect(
      auth.api.updateUser({
        body: { name: 'Bypassed' },
        headers: new Headers({ cookie: sessionCookie }),
      }),
    ).rejects.toMatchObject({ status: 'FORBIDDEN' });
  });

  it('sets the one session cookie sessionTokenFromCookie reads, over plain HTTP too', async () => {
    const { auth, browserCookie } = await signIn('cookie-reader@example.dz');

    const session = await getSession(
      auth,
      new Headers({ cookie: browserCookie }),
    );

    expect(env.APP_URL).toMatch(/^http:\/\//);
    expect(session?.session.token).toEqual(expect.any(String));
    expect(sessionTokenFromCookie(browserCookie)).toBe(session?.session.token);
  });

  it.each([
    '/unlink-account',
    '/revoke-session',
    '/revoke-sessions',
    '/revoke-other-sessions',
  ])('refuses %s on the raw path, whatever the caller sends', async (path) => {
    const { auth } = createAuth(authEnv, {
      emailProvider: new DevEmailProvider(),
    });

    const response = await auth.handler(post(path, { providerId: 'google' }));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: 'ACCOUNT_ENDPOINT_REQUIRED',
    });
  });

  it('requires a session for role-gated actions', () => {
    expect(() => requireRole(null, 'member')).toThrow();
  });

  it('declares account linking where Better Auth reads it', () => {
    const { auth } = createAuth(authEnv, {
      emailProvider: new DevEmailProvider(),
    });
    const linking = auth.options.account?.accountLinking;

    expect(linking?.enabled).toBe(true);
    expect(linking?.trustedProviders).toEqual(['google', 'github']);
    expect(linking?.allowDifferentEmails).toBe(false);
    expect(linking?.updateUserInfoOnLink).toBe(false);
  });
});

describe('libs/auth — the session cookie is the only way in (real D1 via Miniflare)', () => {
  it('takes a session from its signed cookie alone: not from an Authorization header, and not from the bare token', async () => {
    const { auth, browserCookie, sessionCookie } = await signIn(
      'cookie-only@example.dz',
    );
    const token = sessionTokenFromCookie(browserCookie) ?? '';
    const [pair = ''] = sessionCookie.split(';');
    const signedToken = decodeURIComponent(pair.slice(pair.indexOf('=') + 1));

    for (const headers of [
      { authorization: `Bearer ${token}` },
      { authorization: `Bearer ${signedToken}` },
      { cookie: `${SESSION_COOKIE}=${token}` },
    ]) {
      expect(await getSession(auth, new Headers(headers))).toBeNull();
    }
    expect(
      (await getSession(auth, new Headers({ cookie: browserCookie })))?.session
        .token,
    ).toBe(token);
  });

  it('puts the session token in no response header but its HttpOnly cookie', async () => {
    const { response, browserCookie, sessionCookie } = await signIn(
      'httponly@example.dz',
    );
    const token = sessionTokenFromCookie(browserCookie) ?? '';

    expect(token).not.toBe('');
    expect(sessionCookie).toMatch(/;\s*HttpOnly/i);
    expect(
      [...response.headers].filter(
        ([name, value]) => name !== 'set-cookie' && value.includes(token),
      ),
    ).toEqual([]);
  });
});
