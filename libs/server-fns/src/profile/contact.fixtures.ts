import { env } from 'cloudflare:workers';

import { DevEmailProvider, createAuth } from '@founders-coffee/auth';
import { createDb, eq, user } from '@founders-coffee/db';

const authEnv = {
  DB: env.DB,
  BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
  APP_URL: env.APP_URL,
  TURNSTILE_DISABLED: 'true',
};

let seq = 0;
export const nextEmail = () => `member${++seq}.${Date.now()}@contact.test`;

/** Sign a member in with an email code, returning their session cookie and identity. */
export const signedInMember = async () => {
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

export const currentContact = async (
  db: ReturnType<typeof createDb>,
  userId: string,
) => {
  const rows = await db.select().from(user).where(eq(user.id, userId));
  return { email: rows[0]?.email, phone: rows[0]?.phoneNumber };
};
