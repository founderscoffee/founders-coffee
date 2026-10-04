import { createAuth, DevEmailProvider } from '@founders-coffee/auth';
import { env } from 'cloudflare:test';

/**
 * Sign a member in through Better Auth itself, and return the cookies their browser would send.
 *
 * The session lands in the D1 the Worker reads and is signed with the secret it verifies against,
 * so the route guard accepts it exactly as it would a real sign-in. The code comes from the dev
 * provider because D1 only ever holds it hashed.
 */
export const signIn = async (email: string): Promise<string> => {
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
