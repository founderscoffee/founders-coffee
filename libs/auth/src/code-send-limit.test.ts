import '@founders-coffee/observability/server-init';
import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CodeSendRequest } from './code-send-limit.js';
import { createAuthHandler, type HandlerEnv } from './handler.js';
import { DevEmailProvider } from './providers/email.js';

const SENDER = '198.51.100.7';

const baseEnv: HandlerEnv = {
  DB: env.DB,
  BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
  APP_URL: env.APP_URL,
};

const bypassedEnv: HandlerEnv = { ...baseEnv, TURNSTILE_DISABLED: 'true' };

const post = (path: string, body: unknown): Request =>
  new Request(`${env.APP_URL}/api/auth${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': SENDER },
    body: JSON.stringify(body),
  });

const askForCode = (email: string): Request =>
  post('/email-otp/send-verification-otp', { email, type: 'sign-in' });

const recordingLimit = (answers: readonly boolean[]) => {
  const asked: CodeSendRequest[] = [];
  return {
    asked,
    allows: async (request: CodeSendRequest): Promise<boolean> => {
      asked.push(request);
      return answers[asked.length - 1] ?? false;
    },
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('libs/auth code-send limit (real D1 via Miniflare)', () => {
  it('asks about the mailbox and the sender, then mails the code it allows', async () => {
    const emailProvider = new DevEmailProvider();
    const limit = recordingLimit([true]);
    const handler = createAuthHandler(bypassedEnv, {
      emailProvider,
      codeSendLimit: limit.allows,
    });

    const response = await handler(askForCode('allowed@example.dz'));

    expect(response.status).toBe(200);
    expect(emailProvider.sent.map((sent) => sent.email)).toEqual([
      'allowed@example.dz',
    ]);
    expect(limit.asked).toEqual([
      { recipient: 'allowed@example.dz', address: SENDER },
    ]);
  });

  it('answers 429 and mails nothing once the limit says no', async () => {
    const emailProvider = new DevEmailProvider();
    const handler = createAuthHandler(bypassedEnv, {
      emailProvider,
      codeSendLimit: recordingLimit([false]).allows,
    });

    const response = await handler(askForCode('refused@example.dz'));

    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ code: 'TOO_MANY_CODES' });
    expect(emailProvider.sent).toHaveLength(0);
  });

  it('leaves the code already in the inbox working after a refusal', async () => {
    const email = 'kept-code@example.dz';
    const emailProvider = new DevEmailProvider();
    const handler = createAuthHandler(bypassedEnv, {
      emailProvider,
      codeSendLimit: recordingLimit([true, false]).allows,
    });

    await handler(askForCode(email));
    const refused = await handler(askForCode(email));
    const otp = emailProvider.sent[0]?.otp ?? '';
    const signedIn = await handler(post('/sign-in/email-otp', { email, otp }));

    expect(refused.status).toBe(429);
    expect(emailProvider.sent).toHaveLength(1);
    expect(
      signedIn.status,
      'a refused request must not replace the code the member already has',
    ).toBe(200);
  });

  it('closes the route with a 503 when the limit cannot be read, and reports it without the address', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    });
    const emailProvider = new DevEmailProvider();
    const handler = createAuthHandler(bypassedEnv, {
      emailProvider,
      codeSendLimit: () =>
        Promise.reject(new Error('Rate limiting is unavailable')),
    });

    const response = await handler(askForCode('unlimited@example.dz'));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: 'CODE_LIMIT_UNAVAILABLE',
    });
    expect(emailProvider.sent).toHaveLength(0);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? '')).toMatchObject({
      action: 'sign_in_code_limit',
    });
    expect(lines[0]).not.toContain('unlimited@example.dz');
    expect(lines[0]).not.toContain(SENDER);
  });

  it('spends nothing for a request the captcha turned away', async () => {
    const limit = recordingLimit([true]);
    const handler = createAuthHandler(
      { ...baseEnv, TURNSTILE_SECRET_KEY: 'test-secret' },
      { emailProvider: new DevEmailProvider(), codeSendLimit: limit.allows },
    );

    const response = await handler(askForCode('no-challenge@example.dz'));

    expect(response.status).toBe(400);
    expect(
      limit.asked,
      'a budget spent before the captcha check could be emptied by anyone',
    ).toEqual([]);
  });

  it('asks nothing for a request that is not for a code', async () => {
    const limit = recordingLimit([]);
    const handler = createAuthHandler(bypassedEnv, {
      codeSendLimit: limit.allows,
    });

    const response = await handler(
      new Request(`${env.APP_URL}/api/auth/get-session`, { method: 'GET' }),
    );

    expect(response.status).toBe(200);
    expect(limit.asked).toEqual([]);
  });

  it('limits nothing for a handler built without a limit', async () => {
    const emailProvider = new DevEmailProvider();
    const handler = createAuthHandler(baseEnv, {
      emailProvider,
      captchaBypassed: true,
    });

    const response = await handler(askForCode('internal-unlimited@example.dz'));

    expect(response.status).toBe(200);
    expect(emailProvider.sent).toHaveLength(1);
  });
});
