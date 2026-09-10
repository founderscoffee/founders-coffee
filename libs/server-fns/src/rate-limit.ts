import { createMiddleware } from '@tanstack/react-start';
import { getRequestHeader } from '@tanstack/react-start/server';

import { AppError } from '@founders-coffee/core';

import { consumeRateBudget } from './rate-consume.js';

const identityFor = (sessionUserId?: string): string => {
  if (sessionUserId) return `u:${sessionUserId}`;
  return `ip:${getRequestHeader('cf-connecting-ip') ?? 'unknown'}`;
};

/**
 * Identity-scoped rate-limit middleware (AGENTS §10/§11.5): token-bucket via the RateLimiterDO.
 * Throws `AppError('rate_limited')` when the bucket is empty. Identity is the authenticated user id
 * (if a prior `authMiddleware`/`requirePermission` attached `context.session`) or the CF edge IP for
 * anonymous callers. Compose AFTER `requirePermission` on authed RPCs, or alone on anonymous ones.
 *
 * The bucket is created with `DURABLE_OBJECT_LOCATION_HINT` (§11.5). Without a hint the object is
 * created wherever the first request for that identity happens to land, and every later request for
 * the same bucket pays a round trip to that region — for a global edge that can be another
 * continent from the members using it. Western Europe is the closest Cloudflare placement region to
 * the Maghreb user base; `afr` is accepted by the API but has no Durable Object capacity today. An
 * absent binding fails closed rather than silently unlimiting the endpoint.
 */
export const rateLimit = (action: string, limit: number, windowMs: number) =>
  createMiddleware({ type: 'function' }).server(async ({ context, next }) => {
    const sessionUserId = (
      context as unknown as { session?: { user?: { id?: string } } }
    )?.session?.user?.id;
    const allowed = await consumeRateBudget(
      identityFor(sessionUserId),
      action,
      limit,
      windowMs,
    );
    if (!allowed) {
      throw new AppError(
        'rate_limited',
        `Too many ${action} requests. Try again shortly.`,
      );
    }
    return next();
  });
