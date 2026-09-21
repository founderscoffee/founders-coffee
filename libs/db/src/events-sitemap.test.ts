import { and, eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';

import type { Db } from './db.js';
import { createEvent } from './events.js';
import { listCitiesWithUpcomingEvents } from './events-sitemap.js';
import { events, user } from './schema.js';
import { HOST_ID, setupDb } from './operations.fixtures.js';

const HOUR = 60 * 60 * 1000;

/** A published event in a named city, built forward so `createEvent` accepts it. */
const eventIn = async (
  db: Db,
  cityCode: string,
  options: { past?: boolean; status?: 'published' | 'cancelled' } = {},
) => {
  const eventId = id('evt');
  await createEvent(db, {
    id: eventId,
    slug: `sitemap-${cityCode}-${eventId.slice(-6)}`,
    hostId: HOST_ID,
    marketCode: 'DZ',
    stateCode: '16',
    cityCode,
    title: `Sitemap fixture ${cityCode}`,
    description: 'An event used to exercise the sitemap city query.',
    venue: 'Café des Délices, Hydra',
    startsAt: new Date(Date.now() + 48 * HOUR),
    endsAt: new Date(Date.now() + 50 * HOUR),
    language: 'fr',
    status: options.status ?? 'published',
  });
  if (options.past) {
    const endsAt = Math.floor(Date.now() / 1000) - 2 * 3600;
    await db.run(
      sql`UPDATE events SET starts_at = ${endsAt - 7200}, ends_at = ${endsAt}
          WHERE id = ${eventId}`,
    );
  }
  return eventId;
};

const cityCodes = async (db: Db) =>
  (await listCitiesWithUpcomingEvents(db)).map((row) => row.cityCode);

describe('the cities the sitemap is allowed to advertise', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('names a city with an upcoming published gathering', async () => {
    await eventIn(db, '556');

    expect(await cityCodes(db)).toContain('556');
  });

  it('drops a city once its only gathering is over', async () => {
    await eventIn(db, '602', { past: true });

    expect(
      await cityCodes(db),
      'an event page stays indexable after the fact, but the city page goes back to noindex, so the city has to leave',
    ).not.toContain('602');
  });

  it('ignores a cancelled gathering', async () => {
    await eventIn(db, '603', { status: 'cancelled' });

    expect(await cityCodes(db)).not.toContain('603');
  });

  it('ignores a gathering whose host is suppressed', async () => {
    await eventIn(db, '604');
    await db
      .update(user)
      .set({ accountState: 'suppressed' })
      .where(eq(user.id, HOST_ID))
      .run();

    expect(
      await cityCodes(db),
      'upcomingScope hides a suppressed host’s events from the page, so the sitemap must not keep pointing at the city',
    ).not.toContain('604');
  });

  it('names a city once however many gatherings it holds', async () => {
    await eventIn(db, '605');
    await eventIn(db, '605');

    expect((await cityCodes(db)).filter((code) => code === '605')).toHaveLength(
      1,
    );
  });

  it('says nothing at all when no gathering is upcoming', async () => {
    await eventIn(db, '606', { past: true });

    const rows = await listCitiesWithUpcomingEvents(db);

    expect(
      rows.filter((row) => row.marketCode === 'DZ'),
      'an empty answer is what collapses the sitemap from the atlas to the events',
    ).toEqual([]);
  });
});
