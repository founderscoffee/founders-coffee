import { describe, expect, it } from 'vitest';

import { createEvent, listPublicEventDiscoveryRows } from './index.js';
import { baseEvent, nextId, nextSlug, setupDb } from './events.fixtures.js';

describe('public event discovery listing (real D1)', () => {
  it('returns an explicit public projection with a stable public cursor', async () => {
    const db = await setupDb();
    const sameStart = new Date('2099-08-01T10:00:00Z');
    await createEvent(db, {
      ...baseEvent,
      id: nextId(),
      slug: nextSlug(),
      cityCode: 'publicfeedtest',
      startsAt: sameStart,
    });
    await createEvent(db, {
      ...baseEvent,
      id: nextId(),
      slug: nextSlug(),
      cityCode: 'publicfeedtest',
      startsAt: sameStart,
    });
    await createEvent(db, {
      ...baseEvent,
      id: nextId(),
      slug: nextSlug(),
      cityCode: 'publicfeedtest',
      startsAt: sameStart,
    });

    const page1 = await listPublicEventDiscoveryRows(db, {
      marketCodes: ['DZ'],
      limit: 2,
    });
    expect(page1).toHaveLength(2);
    expect(Object.keys(page1[0]).sort()).toEqual(
      [
        'marketCode',
        'marketSlug',
        'timezone',
        'cityCode',
        'slug',
        'title',
        'description',
        'venue',
        'venueAddress',
        'startsAt',
        'endsAt',
        'language',
        'organizerName',
        'organizerEmail',
        'updatedAt',
      ].sort(),
    );
    const page2 = await listPublicEventDiscoveryRows(db, {
      marketCodes: ['DZ'],
      afterStartsAt: page1[1].startsAt,
      afterMarketSlug: page1[1].marketSlug,
      afterSlug: page1[1].slug,
      limit: 2,
    });
    expect(page2.map(({ slug }) => slug)).not.toContain(page1[0].slug);
  });
});
