import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

interface RateLimiterStub {
  consume: (input: {
    limit: number;
    windowMs: number;
  }) => Promise<{ allowed: boolean; remaining: number }>;
}

const namespace = (env as unknown as { RATE_LIMITER: DurableObjectNamespace })
  .RATE_LIMITER;

describe('RateLimiterDO (real Miniflare Durable Object)', () => {
  it('exhausts the create-event bucket after its explicit five-request policy', async () => {
    const id = namespace.idFromName(
      `u:test:create_event:${crypto.randomUUID()}`,
    );
    const stub = namespace.get(id) as unknown as RateLimiterStub;
    const policy = { limit: 5, windowMs: 3_600_000_000 };

    const results = [];
    for (let request = 0; request < 6; request += 1) {
      results.push(await stub.consume(policy));
    }

    expect(results.slice(0, 5).every((result) => result.allowed)).toBe(true);
    expect(results[5]).toMatchObject({ allowed: false, remaining: 0 });
  });
});
