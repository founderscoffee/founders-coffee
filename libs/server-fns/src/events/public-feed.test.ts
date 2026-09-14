import { describe, expect, it } from 'vitest';

import { createEvent, user } from '@founders-coffee/db';

import { readPublicEventFeed } from './public-feed.js';
import { baseEvent, nextId, setupDb } from './resolver.fixtures.js';

describe('public event feed resolver', () => {
  it('projects canonical public event fields without internal identifiers', async () => {
    const db = await setupDb();
    const slug = 'public-feed-projection';
    await createEvent(db, {
      ...baseEvent(nextId(), slug),
      cityCode: '556',
    });

    const result = await readPublicEventFeed(db, { limit: 50 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const event = result.data.items.find((item) => item.slug === slug);
    expect(event).toMatchObject({
      market: 'algeria',
      city: 'algiers',
      cityName: 'Algiers',
      language: 'fr',
      timezone: 'Africa/Algiers',
      organizer: { name: 'Resolve Host' },
      status: 'published',
    });
    expect(event).not.toHaveProperty('id');
    expect(event).not.toHaveProperty('hostId');
    expect(event).not.toHaveProperty('rsvps');
    expect(event).not.toHaveProperty('organizerEmail');
  });

  it('uses a deterministic public cursor and excludes suppressed hosts', async () => {
    const db = await setupDb();
    const first = nextId();
    const secondSlug = `second-${first}`;
    await createEvent(db, {
      ...baseEvent(first, secondSlug),
      cityCode: '556',
    });
    const hiddenHostId = 'usr_publicfeedhidden';
    await db.insert(user).values({
      id: hiddenHostId,
      name: 'Hidden Host',
      email: 'hidden-public-feed@test.coffee',
      role: 'host',
      banned: true,
    });
    const hiddenId = nextId();
    const hiddenSlug = `hidden-${hiddenId}`;
    await createEvent(db, {
      ...baseEvent(hiddenId, hiddenSlug),
      hostId: hiddenHostId,
    });

    const page1 = await readPublicEventFeed(db, { limit: 1 });
    expect(page1.ok).toBe(true);
    if (!page1.ok || !page1.data.nextCursor) return;
    const page2 = await readPublicEventFeed(db, {
      limit: 50,
      cursor: page1.data.nextCursor,
    });
    expect(page2.ok).toBe(true);
    if (!page2.ok) return;
    expect(page2.data.items.map((item) => item.slug)).not.toContain(
      page1.data.items[0]?.slug,
    );
    expect(page2.data.items.map((item) => item.slug)).not.toContain(hiddenSlug);
    expect(page2.data.items.map((item) => item.slug)).toContain(secondSlug);
  });

  it('rejects malformed cursors at the resolver boundary', async () => {
    const result = await readPublicEventFeed(await setupDb(), {
      limit: 20,
      cursor: 'not-a-cursor',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('validation_failed');
  });

  it('does not reveal dark or unknown markets through the filter', async () => {
    const result = await readPublicEventFeed(await setupDb(), {
      market: 'not-a-visible-market',
      limit: 20,
    });

    expect(result).toEqual({ ok: true, data: { items: [], nextCursor: null } });
  });
});
