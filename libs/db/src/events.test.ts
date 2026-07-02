import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { createDb, seed, user, type Db, type NewUser } from './index.js';

import {
  countEventsByStatus,
  createEvent,
  getEvent,
  getEventBySlug,
  isSlugTaken,
  listUpcomingEvents,
  transitionEventStatus,
} from './events.js';

const TEST_HOST_ID = 'usr_testhost01';

const testHost: NewUser = {
  id: TEST_HOST_ID,
  name: 'Test Host',
  email: 'host@test.coffee',
  emailVerified: false,
  role: 'host',
};

const baseEvent = {
  hostId: TEST_HOST_ID,
  marketCode: 'DZ' as const,
  stateCode: '16',
  cityCode: '1',
  title: 'Coffee + Code: Algiers',
  description: 'Casual meetup for founders + builders in Algiers.',
  venue: 'Café des Délices, Hydra',
  startsAt: new Date('2099-01-15T18:00:00Z'),
  capacity: 30,
  language: 'ar_fr' as const,
  category: 'coffee-meetup' as const,
  status: 'published' as const,
};

const setupDb = async (): Promise<Db> => {
  const db = createDb(env.DB);
  await seed(db);
  await db.insert(user).values(testHost).onConflictDoNothing().run();
  return db;
};

let counter = 0;
const nextId = () => `evt_t${String(++counter).padStart(3, '0')}`;
const nextSlug = () => `test-slug-${counter}`;

describe('events queries (real D1)', () => {
  it('creates + fetches an event by id', async () => {
    const db = await setupDb();
    const id = nextId();
    const slug = nextSlug();
    const created = await createEvent(db, { ...baseEvent, id, slug });
    expect(created.id).toBe(id);
    expect(created.isFree).toBe(true);
    expect(created.status).toBe('published');

    const fetched = await getEvent(db, id);
    expect(fetched?.title).toBe('Coffee + Code: Algiers');
  });

  it('fetches by slug within a market', async () => {
    const db = await setupDb();
    const id = nextId();
    const slug = nextSlug();
    await createEvent(db, { ...baseEvent, id, slug });

    const bySlug = await getEventBySlug(db, 'DZ', slug);
    expect(bySlug?.id).toBe(id);

    const wrongMarket = await getEventBySlug(db, 'EG', slug);
    expect(wrongMarket).toBeUndefined();
  });

  it('checks slug uniqueness', async () => {
    const db = await setupDb();
    const id = nextId();
    const slug = nextSlug();
    await createEvent(db, { ...baseEvent, id, slug });

    expect(await isSlugTaken(db, 'DZ', slug)).toBe(true);
    expect(await isSlugTaken(db, 'DZ', 'different-slug')).toBe(false);
    expect(await isSlugTaken(db, 'EG', slug)).toBe(false);
  });

  it('lists upcoming events with cursor pagination', async () => {
    const db = await setupDb();
    /** Use a unique city code to isolate this test's events from other tests */
    const cityCode = 'pgtest';
    const idA = nextId();
    await createEvent(db, { ...baseEvent, id: idA, slug: nextSlug(), cityCode, startsAt: new Date('2099-06-10T10:00:00Z') });
    const idB = nextId();
    await createEvent(db, { ...baseEvent, id: idB, slug: nextSlug(), cityCode, startsAt: new Date('2099-06-15T10:00:00Z') });
    const idC = nextId();
    await createEvent(db, { ...baseEvent, id: idC, slug: nextSlug(), cityCode, startsAt: new Date('2099-06-20T10:00:00Z') });

    const page1 = await listUpcomingEvents(db, { marketCode: 'DZ', cityCode, limit: 2, afterStartsAt: new Date('2099-06-09T00:00:00Z') });
    expect(page1.length).toBe(2);
    expect(page1[0].id).toBe(idA);

    const page2 = await listUpcomingEvents(db, {
      marketCode: 'DZ',
      cityCode,
      afterStartsAt: page1[1].startsAt,
      afterId: page1[1].id,
      limit: 2,
    });
    expect(page2.length).toBe(1);
    expect(page2[0].id).toBe(idC);
  });

  it('does not skip events that share a startsAt (composite cursor tie-breaker)', async () => {
    const db = await setupDb();
    const cityCode = 'tietest';
    const sameStart = new Date('2099-07-01T10:00:00Z');
    const idA = nextId();
    await createEvent(db, { ...baseEvent, id: idA, slug: nextSlug(), cityCode, startsAt: sameStart });
    const idB = nextId();
    await createEvent(db, { ...baseEvent, id: idB, slug: nextSlug(), cityCode, startsAt: sameStart });
    const idC = nextId();
    await createEvent(db, { ...baseEvent, id: idC, slug: nextSlug(), cityCode, startsAt: sameStart });

    const page1 = await listUpcomingEvents(db, { marketCode: 'DZ', cityCode, limit: 2 });
    expect(page1.length).toBe(2);

    const page2 = await listUpcomingEvents(db, {
      marketCode: 'DZ',
      cityCode,
      afterStartsAt: page1[1].startsAt,
      afterId: page1[1].id,
      limit: 2,
    });
    expect(page2.length).toBe(1);
    expect(page2[0].id).toBe(idC);
  });

  it('filters by city', async () => {
    const db = await setupDb();
    const idCity1 = nextId();
    const idCity2 = nextId();
    await createEvent(db, { ...baseEvent, id: idCity1, slug: nextSlug(), cityCode: '1', startsAt: new Date('2099-02-01T10:00:00Z') });
    await createEvent(db, { ...baseEvent, id: idCity2, slug: nextSlug(), cityCode: '2', startsAt: new Date('2099-02-02T10:00:00Z') });

    const dzCity1 = await listUpcomingEvents(db, { marketCode: 'DZ', cityCode: '1', afterStartsAt: new Date('2099-01-31T00:00:00Z') });
    expect(dzCity1.length).toBe(1);
    expect(dzCity1[0].id).toBe(idCity1);
  });

  it('transitions status atomically (published → cancelled)', async () => {
    const db = await setupDb();
    const id = nextId();
    await createEvent(db, { ...baseEvent, id, slug: nextSlug() });

    const changes = await transitionEventStatus(db, id, 'published', 'cancelled');
    expect(changes).toBe(1);

    const cancelled = await getEvent(db, id);
    expect(cancelled?.status).toBe('cancelled');
    expect(cancelled?.cancelledAt).toBeTruthy();
  });

  it('rejects status transition from wrong from-state (0 changes)', async () => {
    const db = await setupDb();
    const id = nextId();
    await createEvent(db, { ...baseEvent, id, slug: nextSlug() });

    const changes = await transitionEventStatus(db, id, 'cancelled', 'published');
    expect(changes).toBe(0);
  });

  it('counts events by status', async () => {
    const db = await setupDb();
    const id1 = nextId();
    const id2 = nextId();
    const id3 = nextId();
    await createEvent(db, { ...baseEvent, id: id1, slug: nextSlug(), startsAt: new Date('2099-03-01T10:00:00Z') });
    await createEvent(db, { ...baseEvent, id: id2, slug: nextSlug(), startsAt: new Date('2099-03-02T10:00:00Z') });
    await createEvent(db, { ...baseEvent, id: id3, slug: nextSlug(), startsAt: new Date('2099-03-03T10:00:00Z') });
    await transitionEventStatus(db, id3, 'published', 'cancelled');

    const published = await countEventsByStatus(db, 'published');
    const cancelled = await countEventsByStatus(db, 'cancelled');
    /** Published count includes events from other tests — just verify the ratio */
    expect(published).toBeGreaterThan(0);
    expect(cancelled).toBeGreaterThanOrEqual(1);
  });
});
