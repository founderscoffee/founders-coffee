import { describe, expect, it } from 'vitest';

import {
  createCloudflareTurnstileProvider,
  type TurnstileVerificationInput,
} from './provider.js';

const validResult = {
  success: true,
  hostname: 'founders.coffee',
  action: 'join_waitlist',
};

const verificationInput = (
  overrides: Partial<TurnstileVerificationInput> = {},
): TurnstileVerificationInput => ({
  token: 'valid-token',
  remoteIp: '203.0.113.10',
  expectedAction: 'join_waitlist',
  ...overrides,
});

const responseFetcher = (
  response: unknown,
  status = 200,
  requests: Array<{ url: string; init?: RequestInit }> = [],
) =>
  (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    return new Response(JSON.stringify(response), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

describe('CloudflareTurnstileProvider (Miniflare)', () => {
  it('validates the expected action and hostname and forwards the edge IP', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const provider = createCloudflareTurnstileProvider(
      'secret-key',
      'founders.coffee',
      responseFetcher(validResult, 200, requests),
    );

    const result = await provider.verify(verificationInput());

    expect(result.ok).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    );
    const body = JSON.parse(String(requests[0]?.init?.body)) as Record<
      string,
      unknown
    >;
    expect(body).toMatchObject({
      secret: 'secret-key',
      response: 'valid-token',
      remoteip: '203.0.113.10',
    });
    expect(body.idempotency_key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('rejects a missing token without contacting Siteverify', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const provider = createCloudflareTurnstileProvider(
      'secret-key',
      'founders.coffee',
      responseFetcher(validResult, 200, requests),
    );

    const result = await provider.verify(
      verificationInput({ token: undefined }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('turnstile_required');
    expect(requests).toHaveLength(0);
  });

  it('rejects an invalid token with a stable error', async () => {
    const provider = createCloudflareTurnstileProvider(
      'secret-key',
      'founders.coffee',
      responseFetcher({
        success: false,
        'error-codes': ['invalid-input-response'],
      }),
    );

    const result = await provider.verify(verificationInput());

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('turnstile_invalid');
  });

  it.each(['expired-token', 'replayed-token'])(
    'rejects the %s timeout-or-duplicate response',
    async (token) => {
      const provider = createCloudflareTurnstileProvider(
        'secret-key',
        'founders.coffee',
        responseFetcher({
          success: false,
          'error-codes': ['timeout-or-duplicate'],
        }),
      );

      const result = await provider.verify(verificationInput({ token }));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('turnstile_expired_or_replayed');
      }
    },
  );

  it('rejects action and hostname mismatches', async () => {
    const wrongAction = createCloudflareTurnstileProvider(
      'secret-key',
      'founders.coffee',
      responseFetcher({ ...validResult, action: 'create_rsvp' }),
    );
    const wrongHostname = createCloudflareTurnstileProvider(
      'secret-key',
      'founders.coffee',
      responseFetcher({ ...validResult, hostname: 'attacker.example' }),
    );

    const [actionResult, hostnameResult] = await Promise.all([
      wrongAction.verify(verificationInput()),
      wrongHostname.verify(verificationInput()),
    ]);

    expect(actionResult.ok).toBe(false);
    expect(hostnameResult.ok).toBe(false);
    if (!actionResult.ok)
      expect(actionResult.error.code).toBe('turnstile_invalid');
    if (!hostnameResult.ok) {
      expect(hostnameResult.error.code).toBe('turnstile_invalid');
    }
  });

  it('maps provider HTTP, payload, and network failures without leaking details', async () => {
    const httpFailure = createCloudflareTurnstileProvider(
      'secret-key',
      'founders.coffee',
      responseFetcher({ internal: 'sensitive-provider-detail' }, 503),
    );
    const payloadFailure = createCloudflareTurnstileProvider(
      'secret-key',
      'founders.coffee',
      responseFetcher({ unexpected: true }),
    );
    const networkFailure = createCloudflareTurnstileProvider(
      'secret-key',
      'founders.coffee',
      (async () => {
        throw new Error('sensitive-network-detail');
      }) as typeof fetch,
    );

    const results = await Promise.all([
      httpFailure.verify(verificationInput()),
      payloadFailure.verify(verificationInput()),
      networkFailure.verify(verificationInput()),
    ]);

    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('turnstile_unavailable');
        expect(result.error.message).not.toMatch(/sensitive|provider|network/i);
      }
    }
  });
});
