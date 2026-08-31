import { DurableObject } from 'cloudflare:workers';

interface BucketState {
  tokens: number;
  lastRefill: number;
}

export interface ConsumeResult {
  allowed: boolean;
  remaining: number;
}

/**
 * Token-bucket rate limiter — one Durable Object per (identity, action) pair, keyed via
 * `idFromName(`${identity}:${action}`)`. Single-threaded DO ⇒ strongly consistent — the only
 * correct primitive for identity-scoped rate limiting on Cloudflare (AGENTS §10/§11.5: DO
 * token-bucket, never KV). `consume` refills based on elapsed wall-clock, then decrements a token.
 */
export class RateLimiterDO extends DurableObject {
  consume = async (opts: {
    limit: number;
    windowMs: number;
  }): Promise<ConsumeResult> => {
    const now = Date.now();
    const refillPerMs = opts.limit / opts.windowMs;
    const state =
      (await this.ctx.storage.get<BucketState>('bucket')) ??
      ({ tokens: opts.limit, lastRefill: now } as BucketState);

    const elapsed = Math.max(0, now - state.lastRefill);
    const refilled = Math.min(opts.limit, state.tokens + elapsed * refillPerMs);

    if (refilled < 1) {
      await this.ctx.storage.put('bucket', {
        tokens: refilled,
        lastRefill: now,
      });
      return { allowed: false, remaining: Math.floor(refilled) };
    }

    const tokens = refilled - 1;
    await this.ctx.storage.put('bucket', { tokens, lastRefill: now });
    return { allowed: true, remaining: Math.floor(tokens) };
  };
}
