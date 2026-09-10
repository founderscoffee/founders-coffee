import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import {
  DevEmailProvider,
  DevSmsProvider,
  createAuth,
} from '@founders-coffee/auth';
import { createDb, eq, user } from '@founders-coffee/db';

import {
  confirmEmailChange,
  confirmPhoneNumber,
  requestEmailChange,
  sendCurrentEmailCode,
  sendPhoneCode,
} from './contact.js';

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

const codeFor = (provider: DevEmailProvider, type: string) =>
  provider.sent.filter((sent) => sent.type === type).at(-1)?.otp ?? '';

const currentEmail = async (
  db: ReturnType<typeof createDb>,
  userId: string,
) => {
  const rows = await db.select().from(user).where(eq(user.id, userId));
  return { email: rows[0]?.email, phone: rows[0]?.phoneNumber };
};

describe('PF-07c — changing a verified email', () => {
  it('moves the address only after both sides are proven', async () => {
    const member = await signedInMember();
    const emailProvider = new DevEmailProvider();
    const deps = { emailProvider };
    const newEmail = nextEmail();

    expect(
      await sendCurrentEmailCode(
        member.userId,
        member.email,
        member.headers,
        deps,
      ),
    ).toMatchObject({ ok: true });
    const proof = codeFor(emailProvider, 'email-verification');
    expect(proof).toHaveLength(6);

    expect(
      await requestEmailChange(
        member.userId,
        { newEmail, otp: proof },
        member.headers,
        deps,
      ),
    ).toMatchObject({ ok: true });
    expect((await currentEmail(member.db, member.userId)).email).toBe(
      member.email,
    );

    const confirmation = codeFor(emailProvider, 'change-email');
    expect(
      await confirmEmailChange(
        member.userId,
        { newEmail, otp: confirmation },
        member.headers,
        deps,
      ),
    ).toMatchObject({ ok: true });
    expect((await currentEmail(member.db, member.userId)).email).toBe(newEmail);
  });

  it('refuses the request when the current address is not proven', async () => {
    const member = await signedInMember();
    const deps = { emailProvider: new DevEmailProvider() };

    const result = await requestEmailChange(
      member.userId,
      { newEmail: nextEmail(), otp: '000000' },
      member.headers,
      deps,
    );

    expect(result).toMatchObject({ ok: false });
    expect((await currentEmail(member.db, member.userId)).email).toBe(
      member.email,
    );
  });

  it('says nothing about an address that already belongs to someone, and moves nothing', async () => {
    const mine = await signedInMember();
    const theirs = await signedInMember();
    const emailProvider = new DevEmailProvider();
    const deps = { emailProvider };

    await sendCurrentEmailCode(mine.userId, mine.email, mine.headers, deps);
    const requested = await requestEmailChange(
      mine.userId,
      {
        newEmail: theirs.email,
        otp: codeFor(emailProvider, 'email-verification'),
      },
      mine.headers,
      deps,
    );

    expect(requested).toMatchObject({ ok: true });
    expect(codeFor(emailProvider, 'change-email')).toBe('');
    expect(emailProvider.sent.some((sent) => sent.email === theirs.email)).toBe(
      false,
    );

    const confirmed = await confirmEmailChange(
      mine.userId,
      { newEmail: theirs.email, otp: '123456' },
      mine.headers,
      deps,
    );

    expect(confirmed).toMatchObject({ ok: false });
    expect((await currentEmail(mine.db, mine.userId)).email).toBe(mine.email);
    expect((await currentEmail(theirs.db, theirs.userId)).email).toBe(
      theirs.email,
    );
  });

  it('refuses a confirmation code that does not match', async () => {
    const member = await signedInMember();
    const emailProvider = new DevEmailProvider();
    const deps = { emailProvider };
    const newEmail = nextEmail();

    await sendCurrentEmailCode(
      member.userId,
      member.email,
      member.headers,
      deps,
    );
    await requestEmailChange(
      member.userId,
      { newEmail, otp: codeFor(emailProvider, 'email-verification') },
      member.headers,
      deps,
    );

    const result = await confirmEmailChange(
      member.userId,
      { newEmail, otp: '999999' },
      member.headers,
      deps,
    );

    expect(result).toMatchObject({ ok: false });
    expect((await currentEmail(member.db, member.userId)).email).toBe(
      member.email,
    );
  });
});
