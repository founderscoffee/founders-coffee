import { describe, expect, it } from 'vitest';

import {
  createEvent,
  createEventIfRouteAvailable,
  getEvent,
  getEventBySlug,
} from './events.js';
import { baseEvent, nextId, nextSlug, setupDb } from './events.fixtures.js';

describe('events queries (real D1)', () => {
  it('creates + fetches an event by id', async () => {
    const db = await setupDb();
    const id = nextId();
    const slug = nextSlug();
    const created = await createEvent(db, { ...baseEvent, id, slug });
    expect(created.id).toBe(id);
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

  it('atomically reserves a route within one market', async () => {
    const db = await setupDb();
    const id = nextId();
    const slug = nextSlug();
    const first = await createEventIfRouteAvailable(db, {
      ...baseEvent,
      id,
      slug,
    });
    const conflict = await createEventIfRouteAvailable(db, {
      ...baseEvent,
      id: nextId(),
      slug,
    });
    const otherMarket = await createEventIfRouteAvailable(db, {
      ...baseEvent,
      id: nextId(),
      marketCode: 'EG',
      slug,
    });

    expect(first?.slug).toBe(slug);
    expect(conflict).toBeUndefined();
    expect(otherMarket?.marketCode).toBe('EG');
    expect(otherMarket?.slug).toBe(slug);
  });
});
