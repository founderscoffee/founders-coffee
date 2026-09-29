import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { createAuthHandler, type HandlerEnv } from './handler.js';
import { DevEmailProvider } from './providers/email.js';

const baseEnv: HandlerEnv = {
  DB: env.DB,
  BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
  APP_URL: env.APP_URL,
};

const sendOtp = (
  email: string,
  headers: Record<string, string> = {},
): Request =>
  new Request(`${env.APP_URL}/api/auth/email-otp/send-verification-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ email, type: 'sign-in' }),
  });

describe('libs/auth handler — captcha gating (real D1 via Miniflare)', () => {
  it('refuses a gated endpoint when no secret key is configured', async () => {
    const emailProvider = new DevEmailProvider();
    const handler = createAuthHandler(baseEnv, { emailProvider });

    const res = await handler(sendOtp('unconfigured@example.dz'));

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'captcha_unconfigured' });
    expect(emailProvider.sent).toHaveLength(0);
  });

  it('allows a gated endpoint only when the bypass is explicit', async () => {
    const emailProvider = new DevEmailProvider();
    const handler = createAuthHandler(
      { ...baseEnv, TURNSTILE_DISABLED: 'true' },
      { emailProvider },
    );

    const res = await handler(sendOtp('bypass@example.dz'));

    expect(res.status).toBe(200);
    expect(emailProvider.sent).toHaveLength(1);
  });

  it('allows an explicitly configured internal handler to call a gated endpoint without a widget', async () => {
    const emailProvider = new DevEmailProvider();
    const handler = createAuthHandler(baseEnv, {
      emailProvider,
      captchaBypassed: true,
    });

    const res = await handler(sendOtp('internal-contact@example.dz'));

    expect(res.status).toBe(200);
    expect(emailProvider.sent).toHaveLength(1);
  });

  it('rejects a gated endpoint with a secret configured but no captcha token', async () => {
    const emailProvider = new DevEmailProvider();
    const handler = createAuthHandler(
      { ...baseEnv, TURNSTILE_SECRET_KEY: 'test-secret' },
      { emailProvider },
    );

    const res = await handler(sendOtp('missing-token@example.dz'));

    expect(res.status).toBe(400);
    expect(emailProvider.sent).toHaveLength(0);
  });

  it('signs in with a captcha configured and no token, since the OTP step is ungated', async () => {
    const email = 'ungated@example.dz';
    const emailProvider = new DevEmailProvider();

    const sendHandler = createAuthHandler(
      { ...baseEnv, TURNSTILE_DISABLED: 'true' },
      { emailProvider },
    );
    expect((await sendHandler(sendOtp(email))).status).toBe(200);
    const otp = emailProvider.sent[0]?.otp;
    if (!otp) throw new Error('OTP was not sent');

    const signInHandler = createAuthHandler(
      { ...baseEnv, TURNSTILE_SECRET_KEY: 'test-secret' },
      { emailProvider },
    );
    const res = await signInHandler(
      new Request(`${env.APP_URL}/api/auth/sign-in/email-otp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('=');
  });

  it('waits for an async email provider to finish before responding', async () => {
    const sent: string[] = [];
    const handler = createAuthHandler(
      { ...baseEnv, TURNSTILE_DISABLED: 'true' },
      {
        emailProvider: {
          sendOtp: async ({ email }) => {
            await scheduler.wait(0);
            sent.push(email);
          },
        },
      },
    );

    const res = await handler(sendOtp('async-provider@example.dz'));

    expect(res.status).toBe(200);
    expect(sent).toEqual(['async-provider@example.dz']);
  });

  it('runs a failing provider to completion before responding, though Better Auth swallows the error', async () => {
    const attempts: string[] = [];
    const handler = createAuthHandler(
      { ...baseEnv, TURNSTILE_DISABLED: 'true' },
      {
        emailProvider: {
          sendOtp: async ({ email }) => {
            await scheduler.wait(0);
            attempts.push(email);
            throw new Error('send failed');
          },
        },
      },
    );

    const res = await handler(sendOtp('async-failure@example.dz'));

    expect(attempts).toEqual(['async-failure@example.dz']);
    expect(res.status).toBe(200);
  });

  it('leaves ungated endpoints reachable without a captcha token', async () => {
    const handler = createAuthHandler(baseEnv, {
      emailProvider: new DevEmailProvider(),
    });

    const res = await handler(
      new Request(`${env.APP_URL}/api/auth/get-session`, { method: 'GET' }),
    );

    expect(res.status).toBe(200);
  });
});

const post = (path: string, body: Record<string, unknown>): Request =>
  new Request(`${env.APP_URL}/api/auth${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

const bypassedEnv: HandlerEnv = { ...baseEnv, TURNSTILE_DISABLED: 'true' };

const registerMember = async (email: string): Promise<void> => {
  const emailProvider = new DevEmailProvider();
  const handler = createAuthHandler(bypassedEnv, { emailProvider });
  await handler(
    post('/email-otp/send-verification-otp', { email, type: 'sign-in' }),
  );
  const otp = emailProvider.sent[0]?.otp;
  if (!otp) throw new Error('OTP was not sent');
  const res = await handler(post('/sign-in/email-otp', { email, otp }));
  if (res.status !== 200) throw new Error(`sign-in failed: ${res.status}`);
};

describe('libs/auth handler — served routes (real D1 via Miniflare)', () => {
  it.each(['/email-otp/request-password-reset', '/forget-password/email-otp'])(
    'answers 404 to %s and mails a member nothing',
    async (path) => {
      const email = `reset${path.length}@example.dz`;
      await registerMember(email);
      const emailProvider = new DevEmailProvider();
      const handler = createAuthHandler(bypassedEnv, { emailProvider });

      const res = await handler(post(path, { email }));

      expect(res.status).toBe(404);
      expect(emailProvider.sent).toHaveLength(0);
    },
  );

  it('answers 404 to the admin API', async () => {
    const handler = createAuthHandler(bypassedEnv);

    const res = await handler(
      new Request(`${env.APP_URL}/api/auth/admin/list-users`, {
        method: 'GET',
      }),
    );

    expect(res.status).toBe(404);
  });

  it.each(['forget-password', 'email-verification'])(
    'refuses to mail a %s code to a member on request from the network',
    async (type) => {
      const email = `${type}@example.dz`;
      await registerMember(email);
      const emailProvider = new DevEmailProvider();
      const handler = createAuthHandler(bypassedEnv, { emailProvider });

      const res = await handler(
        post('/email-otp/send-verification-otp', { email, type }),
      );

      expect(res.status).toBe(400);
      expect(emailProvider.sent).toHaveLength(0);
    },
  );

  it('still mails the contact-change code from the internal handler', async () => {
    const email = 'internal-verification@example.dz';
    await registerMember(email);
    const emailProvider = new DevEmailProvider();
    const handler = createAuthHandler(baseEnv, {
      emailProvider,
      captchaBypassed: true,
    });

    const res = await handler(
      post('/email-otp/send-verification-otp', {
        email,
        type: 'email-verification',
      }),
    );

    expect(res.status).toBe(200);
    expect(emailProvider.sent.map((sent) => sent.type)).toEqual([
      'email-verification',
    ]);
  });
});
