import { beforeEach, describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';

import type { Db } from './db.js';
import { getEventCalendar } from './event-calendar.js';
import { createEvent } from './events.js';
import { HOST_ID, setupDb } from './operations.fixtures.js';

const HOUR = 60 * 60 * 1000;

const calendarEvent = async (db: Db): Promise<string> => {
  const eventId = id('evt');
  await createEvent(db, {
    id: eventId,
    slug: `calendar-${eventId.slice(-6)}`,
    hostId: HOST_ID,
    marketCode: 'DZ',
    stateCode: '16',
    cityCode: '556',
    title: 'لقاء قهوة للمؤسسين',
    description: 'An event used to exercise the calendar query.',
    venue: 'Café des Délices',
    venueAddress: '12 Rue Didouche Mourad, Alger',
    latitude: 36.7538,
    longitude: 3.0588,
    startsAt: new Date(Date.now() + 48 * HOUR),
    endsAt: new Date(Date.now() + 50 * HOUR),
    language: 'ar',
    status: 'published',
  });
  return eventId;
};

describe('getEventCalendar', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('reads what a calendar entry says, with the market clock it happens on', async () => {
    const entry = await getEventCalendar(db, await calendarEvent(db));

    expect(entry).toMatchObject({
      title: 'لقاء قهوة للمؤسسين',
      description: 'An event used to exercise the calendar query.',
      language: 'ar',
      venue: 'Café des Délices',
      venueAddress: '12 Rue Didouche Mourad, Alger',
      latitude: 36.7538,
      longitude: 3.0588,
      status: 'published',
      version: 1,
      timezone: 'Africa/Algiers',
    });
    expect(entry?.startsAt).toBeInstanceOf(Date);
    expect(entry?.endsAt).toBeInstanceOf(Date);
    expect(entry?.updatedAt).toBeInstanceOf(Date);
  });

  it('answers with nothing for an id no event has', async () => {
    expect(await getEventCalendar(db, id('evt'))).toBeUndefined();
  });

  it('selects columns rather than the row, so nothing private can ride along', async () => {
    const entry = await getEventCalendar(db, await calendarEvent(db));

    expect(Object.keys(entry ?? {}).sort()).toEqual([
      'description',
      'endsAt',
      'language',
      'latitude',
      'longitude',
      'startsAt',
      'status',
      'timezone',
      'title',
      'updatedAt',
      'venue',
      'venueAddress',
      'version',
    ]);
  });
});
