import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import {
  createDb,
  createEvent,
  seed,
  user,
  type Db,
  type NewUser,
} from '@founders-coffee/db';
import { eventCreateSchema } from '@founders-coffee/domain';

import {
  createEventResolver,
  createEventResolverWithId,
  eventSlugCandidates,
  resolveEvent,
} from './resolver.js';

const TEST_HOST_ID = 'usr_resolvehost01';

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

const createInput = (overrides: Record<string, unknown> = {}) =>
  eventCreateSchema.parse({
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

describe('createEventResolver (real D1)', () => {
  it('derives state ownership and persists the complete shared command', async () => {
    const db = await setupDb();

    const result = await createEventResolver(db, TEST_HOST_ID, createInput());

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
      });
      expect(result.data.endsAt?.toISOString()).toBe(
        '2099-01-15T19:00:00.000Z',
      );
    }
  });

  it('rejects an unknown city without accepting a client-owned state', async () => {
    const db = await setupDb();

    const result = await createEventResolver(
      db,
      TEST_HOST_ID,
      createInput({ cityCode: 'unknown-city' }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('validation_failed');
  });

  it('reserves distinct routes for concurrent same-title creation', async () => {
    const db = await setupDb();
    const input = createInput({ title: 'Concurrent route reservation' });

    const results = await Promise.all([
      createEventResolver(db, TEST_HOST_ID, input),
      createEventResolver(db, TEST_HOST_ID, input),
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
