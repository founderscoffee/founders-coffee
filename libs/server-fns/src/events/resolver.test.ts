import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { createDb, createEvent, seed, user, type Db, type NewUser } from '@founders-coffee/db';

import { resolveEvent } from './resolver.js';

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

const createTestEvent = async (db: Db): Promise<{ id: string; slug: string }> => {
  const id = nextId();
  const slug = nextSlug();
  await createEvent(db, baseEvent(id, slug));
  return { id, slug };
};

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

    const result = await resolveEvent(db, { marketCode: 'DZ', slug: 'does-not-exist' });
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
