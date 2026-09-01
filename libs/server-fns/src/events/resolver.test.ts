import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { AppError, appValidator, err, ok } from '@founders-coffee/core';
import {
  countEventsByStatus,
  createDb,
  createEvent,
  eq,
  getMarketByCode,
  markets,
  seed,
  user,
  type Db,
  type NewUser,
} from '@founders-coffee/db';
import { eventCreateSchema } from '@founders-coffee/domain';

import { requirePermission } from '../authz.js';
import type { MapProvider } from '../maps/provider.js';
import {
  createEventResolver,
  createEventResolverWithId,
  eventSlugCandidates,
  resolveEvent,
} from './resolver.js';

const TEST_HOST_ID = 'usr_resolvehost01';

const testMapProvider = {
  name: 'test-map',
  getCityViewport: async () =>
    ok({
      center: { latitude: 36.7538, longitude: 3.0588 },
      bounds: [2.9, 36.6, 3.3, 36.9] as const,
    }),
  searchVenues: async () => ok([]),
  reverseVenue: async (input) =>
    ok({
      providerId: 'test-venue',
      name: 'Café des Délices',
      address: '12 Rue des Entrepreneurs, Alger',
      latitude: input.latitude,
      longitude: input.longitude,
    }),
} satisfies MapProvider;

const testHost: NewUser = {
  id: TEST_HOST_ID,
  name: 'Resolve Host',
  email: 'resolve@test.coffee',
  emailVerified: false,
  role: 'host',
};

const setupDb = async (): Promise<Db> => {
  const db = createDb(env.DB);
  await seed(db);
  await db
    .update(markets)
    .set({
      state: 'active',
      featureFlags: {
        events: true,
        hackathons: false,
        payments: false,
        recruiting: false,
      },
    })
    .where(eq(markets.code, 'DZ'))
    .run();
  await db.insert(user).values(testHost).onConflictDoNothing().run();
  return db;
};

let counter = 0;
const nextId = (): string => `evt_r${String(++counter).padStart(3, '0')}`;
const nextSlug = (): string => `resolve-slug-${counter}`;

const baseEvent = (id: string, slug: string) => ({
  hostId: TEST_HOST_ID,
  marketCode: 'DZ' as const,
  stateCode: '16',
  cityCode: '1',
  title: 'Resolver test event',
  description: 'Casual meetup for the resolver test.',
  venue: 'Café des Délices, Hydra',
  startsAt: new Date('2099-01-15T18:00:00Z'),
  capacity: 30,
  language: 'ar_fr' as const,
  category: 'coffee-meetup' as const,
  id,
  slug,
});

const createTestEvent = async (
  db: Db,
): Promise<{ id: string; slug: string }> => {
  const id = nextId();
  const slug = nextSlug();
  await createEvent(db, baseEvent(id, slug));
  return { id, slug };
};

const rawCreateInput = (overrides: Record<string, unknown> = {}) => ({
  marketCode: 'DZ',
  cityCode: '1',
  title: 'Resolver creation event',
  description: 'A complete event created through the resolver.',
  venueName: 'Café des Délices',
  venueAddress: '12 Rue des Entrepreneurs, Alger',
  latitude: 36.7538,
  longitude: 3.0588,
  startsAt: new Date('2099-01-15T18:00:00Z').getTime(),
  endsAt: new Date('2099-01-15T19:00:00Z').getTime(),
  capacity: 24,
  language: 'ar_fr',
  category: 'coffee-meetup',
  ...overrides,
});

const createInput = (overrides: Record<string, unknown> = {}) =>
  eventCreateSchema.parse(rawCreateInput(overrides));

const validationErrorFor = (input: unknown): AppError | undefined => {
  try {
    appValidator(eventCreateSchema)(input);
    return undefined;
  } catch (error) {
    return error instanceof AppError ? error : undefined;
  }
};

describe('create-event boundary (Miniflare)', () => {
  it('rejects unauthenticated and unauthorized creation through centralized authz', async () => {
    const db = await setupDb();
    const before = await countEventsByStatus(db, 'published');

    expect(() => requirePermission(null, 'event', 'create')).toThrowError(
      expect.objectContaining({ code: 'unauthenticated' }),
    );
    expect(() =>
      requirePermission(
        { user: { role: 'sponsor_contact' } } as never,
        'event',
        'create',
      ),
    ).toThrowError(expect.objectContaining({ code: 'forbidden' }));
    expect(await countEventsByStatus(db, 'published')).toBe(before);
  });

  it.each([
    [
      'past schedule',
      (() => {
        const startsAt = Date.now() - 60_000;
        return { startsAt, endsAt: startsAt + 3_600_000 };
      })(),
    ],
    [
      'reversed schedule',
      (() => {
        const startsAt = Date.now() + 3_600_000;
        return { startsAt, endsAt: startsAt - 60_000 };
      })(),
    ],
    ['invalid latitude', { latitude: 91 }],
    ['invalid longitude', { longitude: 181 }],
  ])('rejects %s through appValidator before a D1 write', async (_, patch) => {
    const db = await setupDb();
    const before = await countEventsByStatus(db, 'published');

    const error = validationErrorFor(rawCreateInput(patch));

    expect(error?.code).toBe('validation_failed');
    expect(await countEventsByStatus(db, 'published')).toBe(before);
  });
});

describe('createEventResolver (real D1)', () => {
  it('derives state ownership and persists the complete shared command', async () => {
    const db = await setupDb();

    const result = await createEventResolver(
      db,
      testMapProvider,
      TEST_HOST_ID,
      createInput(),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        hostId: TEST_HOST_ID,
        marketCode: 'DZ',
        stateCode: '01',
        cityCode: '1',
        title: 'Resolver creation event',
        venue: 'Café des Délices',
        venueAddress: '12 Rue des Entrepreneurs, Alger',
        latitude: 36.7538,
        longitude: 3.0588,
        capacity: 24,
        language: 'ar_fr',
        category: 'coffee-meetup',
        isFree: true,
        status: 'published',
        rsvps: 0,
      });
      expect(result.data.id).toMatch(/^evt_[0-9a-f]{32}$/);
      expect(result.data.slug).toBe('resolver-creation-event');
      expect(result.data.createdAt).toBeInstanceOf(Date);
      expect(result.data.updatedAt).toBeInstanceOf(Date);
      expect(result.data.endsAt?.toISOString()).toBe(
        '2099-01-15T19:00:00.000Z',
      );
    }
  });

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

  it('rejects an unsupported venue before writing to D1', async () => {
    const db = await setupDb();
    const before = await countEventsByStatus(db, 'published');
    const rejectingMapProvider: MapProvider = {
      ...testMapProvider,
      reverseVenue: async () =>
        err(new AppError('map_venue_unsupported', 'Select a supported venue')),
    };

    const result = await createEventResolver(
      db,
      rejectingMapProvider,
      TEST_HOST_ID,
      createInput({ title: 'Rejected venue event' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('map_venue_unsupported');
    expect(await countEventsByStatus(db, 'published')).toBe(before);
  });

  it('persists the provider-verified venue instead of client-owned venue text', async () => {
    const db = await setupDb();
    const verifiedMapProvider: MapProvider = {
      ...testMapProvider,
      reverseVenue: async () =>
        ok({
          providerId: 'verified-venue',
          name: 'Verified Coworking Space',
          address: '8 Verified Street, Algiers',
          latitude: 36.754,
          longitude: 3.059,
        }),
    };

    const result = await createEventResolver(
      db,
      verifiedMapProvider,
      TEST_HOST_ID,
      createInput({
        title: 'Canonical venue event',
        venueName: 'Untrusted venue',
        venueAddress: 'Untrusted address',
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        venue: 'Verified Coworking Space',
        venueAddress: '8 Verified Street, Algiers',
        latitude: 36.754,
        longitude: 3.059,
      });
    }
  });

  it('reserves distinct routes for concurrent same-title creation', async () => {
    const db = await setupDb();
    const input = createInput({ title: 'Concurrent route reservation' });

    const results = await Promise.all([
      createEventResolver(db, testMapProvider, TEST_HOST_ID, input),
      createEventResolver(db, testMapProvider, TEST_HOST_ID, input),
    ]);

    expect(results.every((result) => result.ok)).toBe(true);
    const slugs = results.flatMap((result) =>
      result.ok ? [result.data.slug] : [],
    );
    expect(new Set(slugs).size).toBe(2);
    expect(slugs).toContain('concurrent-route-reservation');
  });

  it('returns a typed error when every bounded route candidate conflicts', async () => {
    const db = await setupDb();
    const eventId = 'evt_000000000000000000000000collision';
    const title = 'Exhausted route candidates';
    const [baseSlug, suffixedSlug] = eventSlugCandidates(title, eventId);
    await createEvent(db, baseEvent(nextId(), baseSlug));
    await createEvent(db, baseEvent(nextId(), suffixedSlug));

    const result = await createEventResolverWithId(
      db,
      testMapProvider,
      TEST_HOST_ID,
      createInput({ title }),
      eventId,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('event_route_conflict');
  });
});

describe('resolveEvent (real D1)', () => {
  it('resolves a published event by marketCode + slug', async () => {
    const db = await setupDb();
    const { id, slug } = await createTestEvent(db);

    const result = await resolveEvent(db, { marketCode: 'DZ', slug });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.id).toBe(id);
  });

  it('resolves a published event by id', async () => {
    const db = await setupDb();
    const { id, slug } = await createTestEvent(db);

    const result = await resolveEvent(db, { id });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.slug).toBe(slug);
  });

  it('returns event_not_found for an unknown slug', async () => {
    const db = await setupDb();

    const result = await resolveEvent(db, {
      marketCode: 'DZ',
      slug: 'does-not-exist',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('event_not_found');
  });

  it('returns event_not_found when neither id nor marketCode+slug is given', async () => {
    const db = await setupDb();

    const result = await resolveEvent(db, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('event_not_found');
  });
});
