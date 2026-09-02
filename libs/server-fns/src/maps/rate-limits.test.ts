import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { MAP_RATE_LIMITS, type RateLimitPolicy } from './rate-limits.js';

interface RateLimiterStub {
  consume: (input: {
    limit: number;
    windowMs: number;
  }) => Promise<{ allowed: boolean; remaining: number }>;
}

const namespace = (env as unknown as { RATE_LIMITER: DurableObjectNamespace })
  .RATE_LIMITER;

/** A fresh bucket for one identity and action, as `rateLimit()` keys them. */
const bucketFor = (policy: RateLimitPolicy): RateLimiterStub => {
  const id = namespace.idFromName(
    `ip:203.0.113.9:${policy.action}:${crypto.randomUUID()}`,
  );
  return namespace.get(id) as unknown as RateLimiterStub;
};

const spend = async (
  bucket: RateLimiterStub,
  policy: RateLimitPolicy,
  times: number,
): Promise<boolean[]> => {
  const outcomes: boolean[] = [];
  for (let i = 0; i < times; i += 1) {
    const result = await bucket.consume({
      limit: policy.limit,
      windowMs: policy.windowMs,
    });
    outcomes.push(result.allowed);
  }
  return outcomes;
};

const policies = Object.entries(MAP_RATE_LIMITS);

describe('map endpoint rate-limit policies', () => {
  it.each(policies)('%s admits exactly its limit', async (_name, policy) => {
    const bucket = bucketFor(policy);

    const outcomes = await spend(bucket, policy, policy.limit + 1);

    expect(outcomes.slice(0, policy.limit).every(Boolean)).toBe(true);
    expect(outcomes[policy.limit]).toBe(false);
  });

  it('keeps a separate bucket per endpoint', async () => {
    const identity = crypto.randomUUID();
    const stubFor = (policy: RateLimitPolicy) =>
      namespace.get(
        namespace.idFromName(`ip:203.0.113.9:${policy.action}:${identity}`),
      ) as unknown as RateLimiterStub;

    const search = stubFor(MAP_RATE_LIMITS.venueSearch);
    await spend(
      search,
      MAP_RATE_LIMITS.venueSearch,
      MAP_RATE_LIMITS.venueSearch.limit,
    );
    expect((await spend(search, MAP_RATE_LIMITS.venueSearch, 1))[0]).toBe(
      false,
    );

    const context = stubFor(MAP_RATE_LIMITS.hostMapContext);
    expect((await spend(context, MAP_RATE_LIMITS.hostMapContext, 1))[0]).toBe(
      true,
    );
  });

  it('declares a distinct action per endpoint so buckets cannot collide', () => {
    const actions = policies.map(([, policy]) => policy.action);
    expect(new Set(actions).size).toBe(actions.length);
  });

  it('admits a realistic wizard session without tripping', async () => {
    const search = bucketFor(MAP_RATE_LIMITS.venueSearch);
    const context = bucketFor(MAP_RATE_LIMITS.hostMapContext);
    const reverse = bucketFor(MAP_RATE_LIMITS.venueReverse);

    const cityChanges = 3;
    const venuesTried = 4;
    const keystrokePauses = 6;
    const pinDrops = 5;

    expect(
      (await spend(context, MAP_RATE_LIMITS.hostMapContext, cityChanges)).every(
        Boolean,
      ),
    ).toBe(true);
    expect(
      (
        await spend(
          search,
          MAP_RATE_LIMITS.venueSearch,
          venuesTried * keystrokePauses,
        )
      ).every(Boolean),
    ).toBe(true);
    expect(
      (await spend(reverse, MAP_RATE_LIMITS.venueReverse, pinDrops)).every(
        Boolean,
      ),
    ).toBe(true);
  });
});
