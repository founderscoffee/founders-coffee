import { z } from 'zod';

import { AppError, err, ok, type Result } from '@founders-coffee/core';

const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const SITEVERIFY_TIMEOUT_MS = 10_000;
const TURNSTILE_TOKEN_MAX_LENGTH = 2_048;

const siteverifyResponseSchema = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
  'error-codes': z.array(z.string()).optional(),
});

export interface TurnstileVerificationInput {
  token?: string;
  remoteIp?: string;
  expectedAction: string;
}

export interface TurnstileProvider {
  verify: (input: TurnstileVerificationInput) => Promise<Result<void>>;
}

type TurnstileFetch = typeof fetch;

const verificationError = (code: string, message: string): Result<void> =>
  err(new AppError(code, message));

export const createCloudflareTurnstileProvider = (
  secretKey: string,
  expectedHostname: string,
  fetcher: TurnstileFetch = fetch,
): TurnstileProvider => ({
  verify: async ({ token, remoteIp, expectedAction }) => {
    if (!token) {
      return verificationError(
        'turnstile_required',
        'Bot verification is required',
      );
    }
    if (token.length > TURNSTILE_TOKEN_MAX_LENGTH) {
      return verificationError(
        'turnstile_invalid',
        'Bot verification is invalid',
      );
    }

    try {
      const response = await fetcher(SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          secret: secretKey,
          response: token,
          remoteip: remoteIp,
          idempotency_key: crypto.randomUUID(),
        }),
        signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
      });
      if (!response.ok) {
        return verificationError(
          'turnstile_unavailable',
          'Bot verification is temporarily unavailable',
        );
      }

      const parsed = siteverifyResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        return verificationError(
          'turnstile_unavailable',
          'Bot verification is temporarily unavailable',
        );
      }

      const result = parsed.data;
      const errorCodes = result['error-codes'] ?? [];
      if (!result.success) {
        if (errorCodes.includes('timeout-or-duplicate')) {
          return verificationError(
            'turnstile_expired_or_replayed',
            'Bot verification expired or was already used',
          );
        }
        if (errorCodes.includes('internal-error')) {
          return verificationError(
            'turnstile_unavailable',
            'Bot verification is temporarily unavailable',
          );
        }
        return verificationError(
          'turnstile_invalid',
          'Bot verification is invalid',
        );
      }

      if (
        result.action !== expectedAction ||
        result.hostname !== expectedHostname
      ) {
        return verificationError(
          'turnstile_invalid',
          'Bot verification is invalid',
        );
      }

      return ok(undefined);
    } catch {
      return verificationError(
        'turnstile_unavailable',
        'Bot verification is temporarily unavailable',
      );
    }
  },
});

export const createDevTurnstileProvider = (): TurnstileProvider => ({
  verify: async () => ok(undefined),
});
