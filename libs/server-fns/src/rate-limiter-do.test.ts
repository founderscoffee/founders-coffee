import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { DURABLE_OBJECT_LOCATION_HINT } from '@founders-coffee/infra';

import {
  BUCKET_IDLE_EVICTION_MS,
  type RateLimiterDO,
} from './rate-limiter-do.js';

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

describe('bucket eviction (AR-10)', () => {
  const idFor = (name: string) => namespace.idFromName(name);

  const stubFor = (name: string): RateLimiterStub =>
    namespace.get(idFor(name), {
      locationHint: DURABLE_OBJECT_LOCATION_HINT,
    }) as unknown as RateLimiterStub;

  it('accepts a location hint without changing the bucket identity', async () => {
    const name = `hint:${crypto.randomUUID()}`;
    const policy = { limit: 2, windowMs: 3_600_000_000 };

    await stubFor(name).consume(policy);
    await (namespace.get(idFor(name)) as unknown as RateLimiterStub).consume(
      policy,
    );

    expect(
      await (namespace.get(idFor(name)) as unknown as RateLimiterStub).consume(
        policy,
      ),
    ).toMatchObject({ allowed: false });
  });

  it('arms an eviction alarm when a bucket is used', async () => {
    const name = `alarm:${crypto.randomUUID()}`;
    await stubFor(name).consume({ limit: 5, windowMs: 60_000 });

    const alarmAt = await runInDurableObject(
      namespace.get(idFor(name)),
      (_instance, state) => state.storage.getAlarm(),
    );

    expect(alarmAt).toBeGreaterThan(Date.now());
    expect(alarmAt).toBeLessThanOrEqual(Date.now() + BUCKET_IDLE_EVICTION_MS);
  });

  it('deletes an idle bucket when the alarm fires', async () => {
    const name = `idle:${crypto.randomUUID()}`;
    await stubFor(name).consume({ limit: 5, windowMs: 60_000 });

    await runInDurableObject(namespace.get(idFor(name)), async (_i, state) => {
      await state.storage.put('bucket', {
        tokens: 1,
        lastRefill: Date.now() - BUCKET_IDLE_EVICTION_MS - 1_000,
      });
    });
    await runInDurableObject(
      namespace.get(idFor(name)),
      async (instance: RateLimiterDO) => instance.alarm(),
    );

    const remaining = await runInDurableObject(
      namespace.get(idFor(name)),
      (_i, state) => state.storage.get('bucket'),
    );
    expect(remaining).toBeUndefined();
  });

  it('re-arms instead of deleting a bucket used since the alarm was set', async () => {
    const name = `active:${crypto.randomUUID()}`;
    await stubFor(name).consume({ limit: 5, windowMs: 60_000 });

    await runInDurableObject(
      namespace.get(idFor(name)),
      async (instance: RateLimiterDO) => instance.alarm(),
    );

    const state = await runInDurableObject(
      namespace.get(idFor(name)),
      (_i, s) => s.storage.get('bucket'),
    );
    const alarmAt = await runInDurableObject(
      namespace.get(idFor(name)),
      (_i, s) => s.storage.getAlarm(),
    );
    expect(state).toBeDefined();
    expect(alarmAt).toBeGreaterThan(Date.now());
  });

  it('clears storage when the alarm finds no bucket at all', async () => {
    const name = `empty:${crypto.randomUUID()}`;
    await runInDurableObject(
      namespace.get(idFor(name)),
      async (instance: RateLimiterDO) => instance.alarm(),
    );

    const alarmAt = await runInDurableObject(
      namespace.get(idFor(name)),
      (_i, s) => s.storage.getAlarm(),
    );
    expect(alarmAt).toBeNull();
  });
});
