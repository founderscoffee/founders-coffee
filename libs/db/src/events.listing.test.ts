import { describe, expect, it } from 'vitest';

import {
  countEventsByStatus,
  createEvent,
  getEvent,
  listUpcomingEvents,
  transitionEventStatus,
} from './events.js';
import {
  OTHER_HOST_ID,
  baseEvent,
  nextId,
  nextSlug,
  setupDb,
} from './events.fixtures.js';

describe('events listing (real D1)', () => {
  it('lists upcoming events with cursor pagination', async () => {
    const db = await setupDb();
    const cityCode = 'pgtest';
    const idA = nextId();
    await createEvent(db, {
      ...baseEvent,
      id: idA,
      slug: nextSlug(),
      cityCode,
      startsAt: new Date('2099-06-10T10:00:00Z'),
    });
    const idB = nextId();
    await createEvent(db, {
      ...baseEvent,
      id: idB,
      slug: nextSlug(),
      cityCode,
      startsAt: new Date('2099-06-15T10:00:00Z'),
    });
    const idC = nextId();
    await createEvent(db, {
      ...baseEvent,
      id: idC,
      slug: nextSlug(),
      cityCode,
      startsAt: new Date('2099-06-20T10:00:00Z'),
    });

    const page1 = await listUpcomingEvents(db, {
      marketCode: 'DZ',
      cityCode,
      limit: 2,
      afterStartsAt: new Date('2099-06-09T00:00:00Z'),
    });
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
    await createEvent(db, {
      ...baseEvent,
      id: idA,
      slug: nextSlug(),
      cityCode,
      startsAt: sameStart,
    });
    const idB = nextId();
    await createEvent(db, {
      ...baseEvent,
      id: idB,
      slug: nextSlug(),
      cityCode,
      startsAt: sameStart,
    });
    const idC = nextId();
    await createEvent(db, {
      ...baseEvent,
      id: idC,
      slug: nextSlug(),
      cityCode,
      startsAt: sameStart,
    });

    const page1 = await listUpcomingEvents(db, {
      marketCode: 'DZ',
      cityCode,
      limit: 2,
    });
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

  it("lists only the requested host's upcoming events", async () => {
    const db = await setupDb();
    const mine = nextId();
    const theirs = nextId();
    await createEvent(db, {
      ...baseEvent,
      id: mine,
      slug: `host-mine-${mine}`,
      cityCode: 'hosttest',
      startsAt: new Date('2099-04-01T18:00:00Z'),
    });
    await createEvent(db, {
      ...baseEvent,
      id: theirs,
      slug: `host-theirs-${theirs}`,
      hostId: OTHER_HOST_ID,
      cityCode: 'hosttest',
      startsAt: new Date('2099-04-02T18:00:00Z'),
    });

    const hosted = await listUpcomingEvents(db, {
      hostId: baseEvent.hostId,
      cityCode: 'hosttest',
    });
    const ids = hosted.map((event) => event.id);

    expect(ids).toContain(mine);
    expect(ids).not.toContain(theirs);
    expect(hosted.every((event) => event.hostId === baseEvent.hostId)).toBe(
      true,
    );
  });

  it('filters by city', async () => {
    const db = await setupDb();
    const idCity1 = nextId();
    const idCity2 = nextId();
    await createEvent(db, {
      ...baseEvent,
      id: idCity1,
      slug: nextSlug(),
      cityCode: '1',
      startsAt: new Date('2099-02-01T10:00:00Z'),
    });
    await createEvent(db, {
      ...baseEvent,
      id: idCity2,
      slug: nextSlug(),
      cityCode: '2',
      startsAt: new Date('2099-02-02T10:00:00Z'),
    });

    const dzCity1 = await listUpcomingEvents(db, {
      marketCode: 'DZ',
      cityCode: '1',
      afterStartsAt: new Date('2099-01-31T00:00:00Z'),
    });
    expect(dzCity1.length).toBe(1);
    expect(dzCity1[0].id).toBe(idCity1);
  });

  it('transitions status atomically (published → cancelled)', async () => {
    const db = await setupDb();
    const id = nextId();
    await createEvent(db, { ...baseEvent, id, slug: nextSlug() });

    const changes = await transitionEventStatus(
      db,
      id,
      'published',
      'cancelled',
    );
    expect(changes).toBe(1);

    const cancelled = await getEvent(db, id);
    expect(cancelled?.status).toBe('cancelled');
    expect(cancelled?.cancelledAt).toBeTruthy();
  });

  it('rejects status transition from wrong from-state (0 changes)', async () => {
    const db = await setupDb();
    const id = nextId();
    await createEvent(db, { ...baseEvent, id, slug: nextSlug() });

    const changes = await transitionEventStatus(
      db,
      id,
      'cancelled',
      'published',
    );
    expect(changes).toBe(0);
  });

  it('counts events by status', async () => {
    const db = await setupDb();
    const id1 = nextId();
    const id2 = nextId();
    const id3 = nextId();
    await createEvent(db, {
      ...baseEvent,
      id: id1,
      slug: nextSlug(),
      startsAt: new Date('2099-03-01T10:00:00Z'),
    });
    await createEvent(db, {
      ...baseEvent,
      id: id2,
      slug: nextSlug(),
      startsAt: new Date('2099-03-02T10:00:00Z'),
    });
    await createEvent(db, {
      ...baseEvent,
      id: id3,
      slug: nextSlug(),
      startsAt: new Date('2099-03-03T10:00:00Z'),
    });
    await transitionEventStatus(db, id3, 'published', 'cancelled');

    const published = await countEventsByStatus(db, 'published');
    const cancelled = await countEventsByStatus(db, 'cancelled');
    expect(published).toBeGreaterThan(0);
    expect(cancelled).toBeGreaterThanOrEqual(1);
  });
});
