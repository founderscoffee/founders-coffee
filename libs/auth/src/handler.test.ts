import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { createAuthHandler, type HandlerEnv } from './handler.js';
import { DevEmailProvider } from './providers/email.js';

const baseEnv: HandlerEnv = {
  DB: env.DB,
  BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
  APP_URL: env.APP_URL,
};

const sendOtp = (email: string): Request =>
  new Request(`${env.APP_URL}/api/auth/email-otp/send-verification-otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, type: 'sign-in' }),
  });

describe('libs/auth handler — Turnstile gating (real D1 via Miniflare)', () => {
  it('denies a gated endpoint when no secret key is configured', async () => {
    const emailProvider = new DevEmailProvider();
    const handler = createAuthHandler(baseEnv, { emailProvider });

    const res = await handler(sendOtp('deny@example.dz'));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'turnstile_failed' });
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

  it('leaves ungated endpoints reachable without a Turnstile token', async () => {
    const handler = createAuthHandler(baseEnv, { emailProvider: new DevEmailProvider() });

    const res = await handler(
      new Request(`${env.APP_URL}/api/auth/get-session`, { method: 'GET' }),
    );

    expect(res.status).not.toBe(400);
  });
});
