import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import {
  DevEmailProvider,
  DevSmsProvider,
  createAuth,
} from '@founders-coffee/auth';
import { createDb, eq, user } from '@founders-coffee/db';

import { confirmPhoneNumber, sendPhoneCode } from './contact.js';

const authEnv = {
  DB: env.DB,
  BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
  APP_URL: env.APP_URL,
  TURNSTILE_DISABLED: 'true',
};

let seq = 0;
const nextEmail = () => `member${++seq}.${Date.now()}@contact.test`;

/** Sign a member in with an email code, returning their session cookie and identity. */
const signedInMember = async () => {
  const emailProvider = new DevEmailProvider();
  const { auth } = createAuth(authEnv, { emailProvider });
  const email = nextEmail();
  const base = `${env.APP_URL}/api/auth`;
  const post = (path: string, body: unknown, cookie?: string) =>
    auth.handler(
      new Request(`${base}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: env.APP_URL,
          ...(cookie ? { cookie } : {}),
        },
        body: JSON.stringify(body),
      }),
    );

  await post('/email-otp/send-verification-otp', { email, type: 'sign-in' });
  const otp = emailProvider.sent.at(-1)?.otp ?? '';
  const signIn = await post('/sign-in/email-otp', { email, otp });
  const cookie = (signIn.headers.get('set-cookie') ?? '').split(';')[0];
  const db = createDb(env.DB);
  const rows = await db.select().from(user).where(eq(user.email, email));
  return {
    db,
    email,
    cookie,
    userId: rows[0].id,
    headers: new Headers({ cookie }),
  };
};

const currentEmail = async (
  db: ReturnType<typeof createDb>,
  userId: string,
) => {
  const rows = await db.select().from(user).where(eq(user.id, userId));
  return { email: rows[0]?.email, phone: rows[0]?.phoneNumber };
};

describe('PF-07c — SMS that cannot be delivered', () => {
  it('refuses rather than pretending, where no Twilio credentials exist', async () => {
    const member = await signedInMember();
    const original = (env as Record<string, unknown>).APP_ENVIRONMENT;
    (env as Record<string, unknown>).APP_ENVIRONMENT = 'production';

    try {
      const result = await sendPhoneCode(
        member.userId,
        '+213600000123',
        member.headers,
        { smsProvider: new DevSmsProvider() },
      );
      expect(result).toMatchObject({
        ok: false,
        error: { code: 'sms_unavailable' },
      });
    } finally {
      (env as Record<string, unknown>).APP_ENVIRONMENT = original;
    }
  });
});

describe('PF-07c — adding a verified phone', () => {
  it('attaches the number once its code is proven', async () => {
    const member = await signedInMember();
    const smsProvider = new DevSmsProvider();
    const deps = { smsProvider };
    const phoneNumber = `+2136${String(Date.now()).slice(-8)}`;

    expect(
      await sendPhoneCode(member.userId, phoneNumber, member.headers, deps),
    ).toMatchObject({ ok: true });
    const code = smsProvider.sent.at(-1)?.code ?? '';

    expect(
      await confirmPhoneNumber(
        member.userId,
        { phoneNumber, otp: code },
        member.headers,
        deps,
      ),
    ).toMatchObject({ ok: true });
    expect((await currentEmail(member.db, member.userId)).phone).toBe(
      phoneNumber,
    );
  });

  it('never returns the session token the auth endpoint answers with', async () => {
    const member = await signedInMember();
    const smsProvider = new DevSmsProvider();
    const deps = { smsProvider };
    const phoneNumber = `+2137${String(Date.now()).slice(-8)}`;

    await sendPhoneCode(member.userId, phoneNumber, member.headers, deps);
    const result = await confirmPhoneNumber(
      member.userId,
      { phoneNumber, otp: smsProvider.sent.at(-1)?.code ?? '' },
      member.headers,
      deps,
    );

    expect(result).toEqual({ ok: true, data: { accepted: true } });
    expect(JSON.stringify(result)).not.toContain(member.cookie.split('=')[1]);
  });

  it('refuses a number that already belongs to another member', async () => {
    const first = await signedInMember();
    const second = await signedInMember();
    const smsProvider = new DevSmsProvider();
    const deps = { smsProvider };
    const phoneNumber = `+2138${String(Date.now()).slice(-8)}`;

    await sendPhoneCode(first.userId, phoneNumber, first.headers, deps);
    await confirmPhoneNumber(
      first.userId,
      { phoneNumber, otp: smsProvider.sent.at(-1)?.code ?? '' },
      first.headers,
      deps,
    );

    await sendPhoneCode(second.userId, phoneNumber, second.headers, deps);
    const result = await confirmPhoneNumber(
      second.userId,
      { phoneNumber, otp: smsProvider.sent.at(-1)?.code ?? '' },
      second.headers,
      deps,
    );

    expect(result).toMatchObject({ ok: false });
    expect((await currentEmail(second.db, second.userId)).phone).toBeNull();
    expect((await currentEmail(first.db, first.userId)).phone).toBe(
      phoneNumber,
    );
  });

  it('refuses a code that does not match, leaving no number attached', async () => {
    const member = await signedInMember();
    const smsProvider = new DevSmsProvider();
    const deps = { smsProvider };
    const phoneNumber = `+2139${String(Date.now()).slice(-8)}`;

    await sendPhoneCode(member.userId, phoneNumber, member.headers, deps);
    const result = await confirmPhoneNumber(
      member.userId,
      { phoneNumber, otp: '111111' },
      member.headers,
      deps,
    );

    expect(result).toMatchObject({ ok: false });
    expect((await currentEmail(member.db, member.userId)).phone).toBeNull();
  });
});
