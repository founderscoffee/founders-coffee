import { DurableObject } from 'cloudflare:workers';

interface BucketState {
  tokens: number;
  lastRefill: number;
}

export interface ConsumeResult {
  allowed: boolean;
  remaining: number;
}

export const BUCKET_IDLE_EVICTION_MS = 24 * 60 * 60 * 1000;

export class RateLimiterDO extends DurableObject {
  /**
   * Take one token, refilling continuously since the last call.
   *
   * There is one object per identity-and-action pair, so the population grows with every distinct
   * caller the application ever sees and never shrinks on its own. Each call therefore arms an
   * eviction alarm a day out; a bucket that is used again simply pushes the alarm forward, and one
   * that is abandoned deletes itself. Without it the storage bill grows monotonically for buckets
   * that are indistinguishable from a fresh one.
   */
  // eslint-disable-next-line no-restricted-syntax -- Cloudflare RPC rejects arrow-field methods.
  async consume(opts: {
    limit: number;
    windowMs: number;
  }): Promise<ConsumeResult> {
    const now = Date.now();
    const refillPerMs = opts.limit / opts.windowMs;
    const state =
      (await this.ctx.storage.get<BucketState>('bucket')) ??
      ({ tokens: opts.limit, lastRefill: now } as BucketState);

    const elapsed = Math.max(0, now - state.lastRefill);
    const refilled = Math.min(opts.limit, state.tokens + elapsed * refillPerMs);

    await this.ctx.storage.setAlarm(now + BUCKET_IDLE_EVICTION_MS);

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
  }

  /**
   * Drop an idle bucket's storage, or re-arm if it was used since the alarm was set.
   *
   * Deleting is safe precisely because the bucket is idle: a caller returning after this window
   * would have refilled to full anyway, so a fresh object and an evicted one grant the same
   * allowance. The re-arm branch matters because `consume` overwrites the alarm on every call, and
   * an alarm that already fired must not delete a bucket that has been active since.
   */
  // eslint-disable-next-line no-restricted-syntax -- Cloudflare RPC rejects arrow-field methods.
  override async alarm(): Promise<void> {
    const state = await this.ctx.storage.get<BucketState>('bucket');
    if (!state) {
      await this.ctx.storage.deleteAll();
      return;
    }

    const idleFor = Date.now() - state.lastRefill;
    if (idleFor >= BUCKET_IDLE_EVICTION_MS) {
      await this.ctx.storage.deleteAll();
      return;
    }
    await this.ctx.storage.setAlarm(state.lastRefill + BUCKET_IDLE_EVICTION_MS);
  }
}
