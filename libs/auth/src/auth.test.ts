import { createDb, eq, session as sessionTable, user as userTable } from '@founders-coffee/db';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { createAuth } from './auth.js';
import { getSession, requireRole } from './middleware.js';
import { DevEmailProvider } from './providers/email.js';

const authEnv = {
  DB: env.DB,
  BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
  APP_URL: env.APP_URL,
};

const base = `${env.APP_URL}/api/auth`;

const post = (path: string, body: unknown, cookie?: string): Request => {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (cookie) headers.cookie = cookie;
  return new Request(`${base}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
};

describe('libs/auth — passwordless email-OTP (real D1 via Miniflare)', () => {
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

    const signInRes = await auth.handler(post('/sign-in/email-otp', { email, otp }));
    expect(signInRes.status).toBe(200);
    const sessionCookie = (signInRes.headers.get('set-cookie') ?? '').split(';')[0];
    expect(sessionCookie).toContain('=');

    const db = createDb(env.DB);
    const users = await db.select().from(userTable).where(eq(userTable.email, email)).all();
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

    const session = await getSession(auth, new Headers({ cookie: sessionCookie }));
    expect(session?.user.email).toBe(email);
    expect(session?.user.role).toBe('member');
    expect(() => requireRole(session, 'member')).not.toThrow();
    expect(() => requireRole(session, 'admin')).toThrow();
  });

  it('requires a session for role-gated actions', () => {
    expect(() => requireRole(null, 'member')).toThrow();
  });
});
