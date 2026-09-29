import { env } from 'cloudflare:workers';

import { createAuth } from './auth.js';
import { DevEmailProvider } from './providers/email.js';

export const authEnv = {
  DB: env.DB,
  BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
  APP_URL: env.APP_URL,
  TURNSTILE_DISABLED: 'true',
};

const base = `${env.APP_URL}/api/auth`;

export const post = (path: string, body: unknown, cookie?: string): Request => {
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

export const SESSION_COOKIE = '__Secure-better-auth.session_token';

export const signIn = async (email: string) => {
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
