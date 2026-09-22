import { beforeEach, describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';

import type { Db } from './db.js';
import { createEvent } from './events.js';
import { getEventCard } from './event-card.js';
import { HOST_ID, setupDb } from './operations.fixtures.js';

const HOUR = 60 * 60 * 1000;

const cardEvent = async (
  db: Db,
  options: { status?: 'published' | 'draft' } = {},
): Promise<string> => {
  const eventId = id('evt');
  await createEvent(db, {
    id: eventId,
    slug: `card-${eventId.slice(-6)}`,
    hostId: HOST_ID,
    marketCode: 'DZ',
    stateCode: '16',
    cityCode: '556',
    title: 'لقاء قهوة للمؤسسين',
    description: 'An event used to exercise the social card query.',
    venue: 'Café des Délices, Hydra',
    startsAt: new Date(Date.now() + 48 * HOUR),
    endsAt: new Date(Date.now() + 50 * HOUR),
    language: 'ar',
    status: options.status ?? 'published',
  });
  return eventId;
};

describe('getEventCard', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('draws the event together with its host and its market clock', async () => {
    const card = await getEventCard(db, await cardEvent(db));
    expect(card).toMatchObject({
      title: 'لقاء قهوة للمؤسسين',
      marketCode: 'DZ',
      cityCode: '556',
      status: 'published',
      hostName: 'Ops Host',
      timezone: 'Africa/Algiers',
    });
  });

  it('answers for an event that is not published, so the caller can decide', async () => {
    const card = await getEventCard(
      db,
      await cardEvent(db, { status: 'draft' }),
    );
    expect(card?.status).toBe('draft');
  });

  it('answers with nothing for an id no event has', async () => {
    expect(await getEventCard(db, id('evt'))).toBeUndefined();
  });

  it('carries the version the card address is keyed on', async () => {
    const card = await getEventCard(db, await cardEvent(db));
    expect(typeof card?.version).toBe('number');
  });

  it('selects columns rather than the row, so nothing private can ride along', async () => {
    const card = await getEventCard(db, await cardEvent(db));
    expect(Object.keys(card ?? {}).sort()).toEqual([
      'cityCode',
      'hostName',
      'marketCode',
      'startsAt',
      'status',
      'timezone',
      'title',
      'version',
    ]);
  });
});
