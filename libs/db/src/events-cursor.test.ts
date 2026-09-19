import { describe, expect, it } from 'vitest';

import { feedCursorAnchorExists } from './events-cursor.js';
import { createEvent, transitionEventStatus } from './events.js';
import { baseEvent, nextId, nextSlug, setupDb } from './events.fixtures.js';

const STARTS_AT = new Date('2099-06-10T10:00:00Z');
const CITY = 'curtest';

describe('feedCursorAnchorExists (real D1)', () => {
  it('says yes to a cursor naming a row still in the feed it came from', async () => {
    const db = await setupDb();
    const id = nextId();
    await createEvent(db, {
      ...baseEvent,
      id,
      slug: nextSlug(),
      cityCode: CITY,
      startsAt: STARTS_AT,
    });

    expect(
      await feedCursorAnchorExists(db, {
        id,
        startsAt: STARTS_AT,
        marketCode: 'DZ',
        cityCode: CITY,
      }),
    ).toBe(true);
  });

  it('says no to an id no event carries', async () => {
    const db = await setupDb();
    expect(
      await feedCursorAnchorExists(db, {
        id: 'evt_invented',
        startsAt: STARTS_AT,
        marketCode: 'DZ',
      }),
    ).toBe(false);
  });

  it('says no when the timestamp is not the one that id starts at', async () => {
    const db = await setupDb();
    const id = nextId();
    await createEvent(db, {
      ...baseEvent,
      id,
      slug: nextSlug(),
      cityCode: CITY,
      startsAt: STARTS_AT,
    });

    expect(
      await feedCursorAnchorExists(db, {
        id,
        startsAt: new Date('2099-06-11T10:00:00Z'),
        marketCode: 'DZ',
        cityCode: CITY,
      }),
      'a real id plus an arbitrary timestamp would mint unlimited valid-looking cursors',
    ).toBe(false);
  });

  it('says no to a cursor carried over to a feed it did not come from', async () => {
    const db = await setupDb();
    const id = nextId();
    await createEvent(db, {
      ...baseEvent,
      id,
      slug: nextSlug(),
      cityCode: CITY,
      startsAt: STARTS_AT,
    });

    expect(
      await feedCursorAnchorExists(db, {
        id,
        startsAt: STARTS_AT,
        marketCode: 'DZ',
        cityCode: 'elsewhere',
      }),
    ).toBe(false);
  });

  it('says no once the anchor event has been cancelled', async () => {
    const db = await setupDb();
    const id = nextId();
    await createEvent(db, {
      ...baseEvent,
      id,
      slug: nextSlug(),
      cityCode: CITY,
      startsAt: STARTS_AT,
    });
    await transitionEventStatus(db, id, 'published', 'cancelled');

    expect(
      await feedCursorAnchorExists(db, {
        id,
        startsAt: STARTS_AT,
        marketCode: 'DZ',
        cityCode: CITY,
      }),
    ).toBe(false);
  });

  it('says no once the anchor event is behind the reader', async () => {
    const db = await setupDb();
    const id = nextId();
    await createEvent(db, {
      ...baseEvent,
      id,
      slug: nextSlug(),
      cityCode: CITY,
      startsAt: STARTS_AT,
    });

    expect(
      await feedCursorAnchorExists(db, {
        id,
        startsAt: STARTS_AT,
        marketCode: 'DZ',
        cityCode: CITY,
        now: new Date('2100-01-01T00:00:00Z'),
      }),
      'a bookmarked cursor is a position in a feed, and the feed has moved past it',
    ).toBe(false);
  });
});
