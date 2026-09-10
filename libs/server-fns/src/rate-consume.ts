import { AppError } from '@founders-coffee/core';
import { DURABLE_OBJECT_LOCATION_HINT } from '@founders-coffee/infra';

import { workerEnv } from './env.js';

interface ConsumeResult {
  allowed: boolean;
  remaining: number;
}

interface RateLimiterStub {
  consume: (opts: {
    limit: number;
    windowMs: number;
  }) => Promise<ConsumeResult>;
}

/**
 * Spend one token from a named bucket, for callers outside the server-function pipeline.
 *
 * The middleware below reads its identity from TanStack's request context, which a raw `fetch`
 * handler does not have. Photo uploads are served that way — a multi-megabyte body has no business
 * being serialized through an RPC envelope — and they still have to draw on the same Durable Object
 * bucket as everything else, so the consumption is here rather than duplicated there with its own
 * naming scheme.
 */
export const consumeRateBudget = async (
  identity: string,
  action: string,
  limit: number,
  windowMs: number,
): Promise<boolean> => {
  const namespace = workerEnv().RATE_LIMITER;
  if (!namespace) {
    throw new AppError(
      'security_configuration_error',
      'Rate limiting is unavailable',
    );
  }
  const id = namespace.idFromName(`${identity}:${action}`);
  const result = await (
    namespace.get(id, {
      locationHint: DURABLE_OBJECT_LOCATION_HINT,
    }) as unknown as RateLimiterStub
  ).consume({ limit, windowMs });
  return result.allowed;
};
