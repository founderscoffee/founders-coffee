import { describe, expect, it } from 'vitest';

import { eq, getMarketByCode, markets } from '@founders-coffee/db';

import type { MapProvider } from '../maps/provider.js';
import { createEventResolver } from './resolver.js';
import {
  createInput,
  setupDb,
  testMapProvider,
  TEST_HOST_ID,
} from './resolver.fixtures.js';

describe('createEventResolver market and geography (real D1)', () => {
  it('allows event creation in an open market', async () => {
    const db = await setupDb();
    await db
      .update(markets)
      .set({ state: 'open' })
      .where(eq(markets.code, 'DZ'))
      .run();

    const result = await createEventResolver(
      db,
      testMapProvider,
      TEST_HOST_ID,
      createInput({ title: 'Open market event' }),
    );

    expect(result.ok).toBe(true);
  });

  it('rejects unknown and dark markets with the same non-leaking error', async () => {
    const db = await setupDb();
    await db
      .update(markets)
      .set({ state: 'dark' })
      .where(eq(markets.code, 'DZ'))
      .run();

    const darkResult = await createEventResolver(
      db,
      testMapProvider,
      TEST_HOST_ID,
      createInput({ title: 'Dark market event' }),
    );
    const unknownResult = await createEventResolver(
      db,
      testMapProvider,
      TEST_HOST_ID,
      createInput({ marketCode: 'ZZ', title: 'Unknown market event' }),
    );

    expect(darkResult.ok).toBe(false);
    expect(unknownResult.ok).toBe(false);
    if (!darkResult.ok) {
      expect(darkResult.error.code).toBe('event_market_unavailable');
      expect(darkResult.error.message).not.toContain('DZ');
    }
    if (!unknownResult.ok) {
      expect(unknownResult.error.code).toBe('event_market_unavailable');
      expect(unknownResult.error.message).not.toContain('ZZ');
    }
  });

  it('rejects a market whose events feature is disabled', async () => {
    const db = await setupDb();
    const market = await getMarketByCode(db, 'DZ');
    expect(market).toBeDefined();
    if (!market) return;
    await db
      .update(markets)
      .set({ featureFlags: { ...market.featureFlags, events: false } })
      .where(eq(markets.code, 'DZ'))
      .run();

    const result = await createEventResolver(
      db,
      testMapProvider,
      TEST_HOST_ID,
      createInput({ title: 'Disabled events feature' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('event_creation_disabled');
  });

  it('rejects an unknown city without accepting a client-owned state', async () => {
    const db = await setupDb();

    const result = await createEventResolver(
      db,
      testMapProvider,
      TEST_HOST_ID,
      createInput({ cityCode: 'unknown-city' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('validation_failed');
  });

  it('maps an unexpected provider exception to a stable non-leaking error', async () => {
    const db = await setupDb();
    const throwingProvider: MapProvider = {
      ...testMapProvider,
      reverseVenue: async () => {
        throw new Error('provider-internal-sensitive-detail');
      },
    };

    const result = await createEventResolver(
      db,
      throwingProvider,
      TEST_HOST_ID,
      createInput({ title: 'Throwing provider event' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('event_creation_failed');
      expect(result.error.message).not.toContain('provider-internal');
    }
  });

  it('maps a D1 repository failure to a stable non-leaking error', async () => {
    const db = await setupDb();

    const result = await createEventResolver(
      db,
      testMapProvider,
      'usr_missing_host',
      createInput({ title: 'Missing host event' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('event_creation_failed');
      expect(result.error.message).not.toMatch(/foreign|constraint|user/i);
    }
  });
});
