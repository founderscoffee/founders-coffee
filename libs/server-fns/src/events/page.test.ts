import { describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';
import {
  createEvent,
  createRsvp,
  eq,
  markets,
  user,
} from '@founders-coffee/db';
import { geo } from '@founders-coffee/domain';

import { readEventPage } from './page.js';
import {
  TEST_HOST_ID,
  baseEvent,
  createTestEvent,
  nextId,
  setupDb,
} from './resolver.fixtures.js';

const READER_ID = 'usr_pagereader01';
const ERASED_HOST_ID = 'usr_pageerased01';

const anonymous = () => Promise.resolve(undefined);

describe('readEventPage (real D1)', () => {
  it('answers with the market, the meetup and its host card', async () => {
    const db = await setupDb();
    const { id: eventId, slug } = await createTestEvent(db);

    const page = await readEventPage(
      db,
      { marketCode: 'DZ', slug },
      anonymous(),
    );

    expect(page.ok).toBe(true);
    if (!page.ok) return;
    expect(page.data.market).toMatchObject({ code: 'DZ', slug: 'algeria' });
    expect(page.data.event).toMatchObject({
      id: eventId,
      viewerRsvp: null,
      cityName: geo.findCity('DZ', '1')?.name,
    });
    expect(page.data.host).toMatchObject({
      userId: TEST_HOST_ID,
      displayName: 'Resolve Host',
    });
  });

  it('tells a reader who is going that they are', async () => {
    const db = await setupDb();
    const { id: eventId, slug } = await createTestEvent(db);
    await db
      .insert(user)
      .values({
        id: READER_ID,
        name: 'Page Reader',
        email: 'page-reader@test.coffee',
        emailVerified: false,
        role: 'member',
      })
      .onConflictDoNothing()
      .run();
    await createRsvp(db, { id: id('rsvp'), eventId, userId: READER_ID });

    const page = await readEventPage(
      db,
      { marketCode: 'DZ', slug },
      Promise.resolve(READER_ID),
    );

    expect(page.ok && page.data.event).toMatchObject({
      goingCount: 1,
      viewerRsvp: 'going',
    });
  });

  it("keeps an erased host's meetup on its page, without a card (#105)", async () => {
    const db = await setupDb();
    await db
      .insert(user)
      .values({
        id: ERASED_HOST_ID,
        name: '',
        email: 'page-erased@test.coffee',
        emailVerified: false,
        role: 'host',
        accountState: 'deleted',
      })
      .onConflictDoNothing()
      .run();
    const slug = 'page-erased-host';
    await createEvent(db, {
      ...baseEvent(nextId(), slug),
      hostId: ERASED_HOST_ID,
    });

    const page = await readEventPage(
      db,
      { marketCode: 'DZ', slug },
      anonymous(),
    );

    expect(page.ok).toBe(true);
    if (page.ok) expect(page.data.host).toBeNull();
  });

  it.each([
    ['banned', { banned: true }],
    ['closing', { accountState: 'closing' as const }],
    ['banned and erased', { banned: true, accountState: 'deleted' as const }],
  ])(
    "answers a %s host's meetup as a missing meetup",
    async (_label, change) => {
      const db = await setupDb();
      const { slug } = await createTestEvent(db);
      await db.update(user).set(change).where(eq(user.id, TEST_HOST_ID)).run();

      const page = await readEventPage(
        db,
        { marketCode: 'DZ', slug },
        anonymous(),
      );

      await db
        .update(user)
        .set({ banned: false, accountState: 'active' })
        .where(eq(user.id, TEST_HOST_ID))
        .run();
      expect(!page.ok && page.error.code).toBe('event_not_found');
    },
  );

  it('answers a slug no meetup has as a missing meetup', async () => {
    const db = await setupDb();

    const page = await readEventPage(
      db,
      { marketCode: 'DZ', slug: 'no-such-meetup' },
      anonymous(),
    );

    expect(!page.ok && page.error.code).toBe('event_not_found');
  });

  it('answers a meetup in a dark market as a missing market', async () => {
    const db = await setupDb();
    const slug = 'page-dark-market';
    await createEvent(db, {
      ...baseEvent(nextId(), slug),
      marketCode: 'EG',
      stateCode: '01',
      cityCode: '1',
    });
    await db
      .update(markets)
      .set({ state: 'dark' })
      .where(eq(markets.code, 'EG'))
      .run();

    const page = await readEventPage(
      db,
      { marketCode: 'EG', slug },
      anonymous(),
    );

    expect(!page.ok && page.error.code).toBe('market_not_found');
  });
});
