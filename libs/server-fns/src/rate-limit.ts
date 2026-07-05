import { createMiddleware } from '@tanstack/react-start';
import { getRequestHeader } from '@tanstack/react-start/server';
import { env } from 'cloudflare:workers';

import { AppError } from '@founders-coffee/core';

interface ConsumeResult {
  allowed: boolean;
  remaining: number;
}

interface RateLimiterStub {
  consume: (opts: { limit: number; windowMs: number }) => Promise<ConsumeResult>;
}

const identityFor = (sessionUserId?: string): string => {
  if (sessionUserId) return `u:${sessionUserId}`;
  return `ip:${getRequestHeader('cf-connecting-ip') ?? 'unknown'}`;
};

/**
 * Identity-scoped rate-limit middleware (AGENTS §10/§11.5): token-bucket via the RateLimiterDO.
 * Throws `AppError('rate_limited')` when the bucket is empty. Identity is the authenticated user id
 * (if a prior `authMiddleware`/`requirePermission` attached `context.session`) or the CF edge IP for
 * anonymous callers. Compose AFTER `requirePermission` on authed RPCs, or alone on anonymous ones.
 */
export const rateLimit = (action: string, limit: number, windowMs: number) =>
  createMiddleware({ type: 'function' }).server(async ({ context, next }) => {
    const sessionUserId = (context as unknown as { session?: { user?: { id?: string } } })?.session?.user?.id;
    const namespace = (env as { RATE_LIMITER: DurableObjectNamespace }).RATE_LIMITER;
    const id = namespace.idFromName(`${identityFor(sessionUserId)}:${action}`);
    const result = await (namespace.get(id) as unknown as RateLimiterStub).consume({ limit, windowMs });
    if (!result.allowed) {
      throw new AppError('rate_limited', `Too many ${action} requests. Try again shortly.`);
    }
    return next();
  });
