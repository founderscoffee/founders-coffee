import { beforeEach, describe, expect, it } from 'vitest';

import type { Db, Event } from '@founders-coffee/db';

import { scheduleTelegramGroup, telegramWrapUpAt } from './notices.js';
import {
  connectMeetup,
  payloadOf,
  pendingKeys,
  seedMeetup,
  setupDb,
  telegramRows,
} from './telegram.fixtures.js';

const HOUR_MS = 60 * 60 * 1000;

describe('Telegram group notices (real D1 via Miniflare)', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  const connected = async (overrides: Partial<Event> = {}) => {
    const event = await seedMeetup(db, overrides);
    await connectMeetup(db, event);
    return event;
  };

  it('pins the details at once and queues the reminder and the goodbye', async () => {
    const event = await connected();
    const now = new Date();

    await scheduleTelegramGroup(db, event, now);

    const rows = await telegramRows(db, event.id);
    expect(rows.map((row) => [row.templateKey, row.sendAt.getTime()])).toEqual([
      ['telegram_details', Math.floor(now.getTime() / 1000) * 1000],
      ['telegram_reminder', event.startsAt.getTime() - 24 * HOUR_MS],
      ['telegram_wrap_up', (event.endsAt?.getTime() ?? 0) + 24 * HOUR_MS],
    ]);
    expect(rows.every((row) => row.userId === event.hostId)).toBe(true);
    const details = payloadOf(rows[0]);
    expect(details.telegramText).toBeUndefined();
    expect(details.telegramPinnedText).toContain(event.title);
    expect(details.telegramPinnedText).toContain(
      'Café des Délices, 12 Rue Didouche Mourad',
    );
    expect(details.telegramPinnedText).toContain(`/en/algeria/e/${event.slug}`);
  });

  it('writes the posts in the meetup language, whatever the host reads in', async () => {
    const event = await connected({ language: 'ar' });

    await scheduleTelegramGroup(db, event);

    const [details, reminder] = await telegramRows(db, event.id);
    expect(payloadOf(details).locale).toBe('ar');
    expect(payloadOf(details).telegramPinnedText).toContain(
      'Café des Délices، 12 Rue Didouche Mourad',
    );
    expect(payloadOf(reminder).telegramText).toMatch(/^غدًا: /);
  });

  it('names the venue once when the address adds nothing', async () => {
    const event = await connected({ venueAddress: null });

    await scheduleTelegramGroup(db, event);

    const [details] = await telegramRows(db, event.id);
    expect(payloadOf(details).telegramPinnedText).toContain(
      '\nCafé des Délices\n',
    );
  });

  it('skips the reminder when the meetup is less than a day away', async () => {
    const soon = new Date(Date.now() + 5 * HOUR_MS);
    const event = await connected({
      startsAt: soon,
      endsAt: new Date(soon.getTime() + 2 * HOUR_MS),
    });

    await scheduleTelegramGroup(db, event);

    expect(await pendingKeys(db, event.id)).toEqual([
      'telegram_details',
      'telegram_wrap_up',
    ]);
  });

  it('says goodbye two hours plus a day after a start with no end', () => {
    const startsAt = new Date('2099-01-15T18:00:00Z');
    expect(telegramWrapUpAt({ startsAt, endsAt: null })).toEqual(
      new Date('2099-01-16T20:00:00Z'),
    );
  });

  it('links the goodbye to the city, where the next meetups are', async () => {
    const event = await connected();

    await scheduleTelegramGroup(db, event);

    const wrapUp = (await telegramRows(db, event.id)).find(
      (row) => row.templateKey === 'telegram_wrap_up',
    );
    expect(payloadOf(wrapUp).telegramText).toContain(
      'http://localhost/en/algeria/algiers',
    );
  });
});
