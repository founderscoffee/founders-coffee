import { describe, expect, it } from 'vitest';

import { createEvent, events, type Db } from '@founders-coffee/db';
import { eq } from 'drizzle-orm';

import { readEventCard } from './card.js';
import { baseEvent, nextId, setupDb } from './resolver.fixtures.js';

const eventWith = async (
  db: Db,
  status: 'published' | 'draft' | 'cancelled',
): Promise<string> => {
  const id = nextId();
  await createEvent(db, {
    ...baseEvent(id, `card-${id}`),
    cityCode: '556',
    title: 'لقاء قهوة للمؤسسين',
  });
  if (status !== 'published') {
    await db.update(events).set({ status }).where(eq(events.id, id)).run();
  }
  return id;
};

describe('readEventCard', () => {
  it('draws a published meetup, with its city named in every language', async () => {
    const db = await setupDb();
    const card = await readEventCard(db, await eventWith(db, 'published'));
    expect(card).toMatchObject({
      title: 'لقاء قهوة للمؤسسين',
      hostName: 'Resolve Host',
      timezone: 'Africa/Algiers',
      cityName: 'Algiers',
      cityNameAr: 'الجزائر العاصمة',
      cityNameFr: 'Alger',
    });
  });

  it('says nothing about a draft, whose title nobody has been shown', async () => {
    const db = await setupDb();
    expect(await readEventCard(db, await eventWith(db, 'draft'))).toBeNull();
  });

  it('says nothing about a cancelled meetup, which has stopped advertising', async () => {
    const db = await setupDb();
    expect(
      await readEventCard(db, await eventWith(db, 'cancelled')),
    ).toBeNull();
  });

  it('says nothing about an id no meetup has', async () => {
    const db = await setupDb();
    expect(await readEventCard(db, nextId())).toBeNull();
  });

  it('carries the version the card address is keyed on', async () => {
    const db = await setupDb();
    const card = await readEventCard(db, await eventWith(db, 'published'));
    expect(card?.version).toBe(1);
  });
});
