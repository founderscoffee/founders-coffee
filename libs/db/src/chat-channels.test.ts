import { beforeEach, describe, expect, it } from 'vitest';

import { id, idSchema } from '@founders-coffee/core';

import {
  CHAT_KEPT_AFTER_MEETUP_SECONDS,
  CHAT_OPEN_AFTER_MEETUP_SECONDS,
  getChatChannel,
  insertChatChannel,
  syncChatChannel,
} from './chat-channels.js';
import { DAY_SECONDS, meetupRow, publishMeetup } from './chat.fixtures.js';
import {
  createEvent,
  createEventIfRouteAvailable,
  getEvent,
  transitionEventStatus,
} from './events.js';
import { updateEventIfCurrent } from './events-update.js';
import type { Db } from './index.js';
import { setupDb } from './rsvps.fixtures.js';

const ENDS_AT = new Date('2099-01-15T20:00:00Z');

const after = (moment: Date, seconds: number): Date =>
  new Date(moment.getTime() + seconds * 1000);

const changesOf = (result: { meta?: { changes?: number } }): number =>
  result.meta?.changes ?? 0;

describe("a meetup's chat is written with it (real D1)", () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('gives a published meetup its chat, open for a week after it ends and kept for 90 days', async () => {
    const eventId = await publishMeetup(db);

    const chat = await getChatChannel(db, eventId);

    expect(chat).toMatchObject({
      kind: 'meetup',
      eventId,
      marketCode: 'DZ',
      readOnlyAt: after(ENDS_AT, CHAT_OPEN_AFTER_MEETUP_SECONDS),
      expiresAt: after(ENDS_AT, CHAT_KEPT_AFTER_MEETUP_SECONDS),
    });
    expect(idSchema.safeParse(chat?.id).success).toBe(true);
  });

  it('takes a meetup with no end to last the two hours every listing assumes', async () => {
    const startsAt = new Date('2099-02-01T18:00:00Z');
    const eventId = await publishMeetup(db, { startsAt, endsAt: null });

    const chat = await getChatChannel(db, eventId);

    expect(chat?.readOnlyAt).toEqual(
      after(startsAt, 2 * 60 * 60 + CHAT_OPEN_AFTER_MEETUP_SECONDS),
    );
    expect(chat?.expiresAt).toEqual(
      after(startsAt, 2 * 60 * 60 + CHAT_KEPT_AFTER_MEETUP_SECONDS),
    );
  });

  it('writes no chat for a meetup whose address was taken', async () => {
    const taken = await publishMeetup(db, { slug: 'chat-taken-address' });
    const row = meetupRow({ slug: 'chat-taken-address' });

    const created = await createEventIfRouteAvailable(db, row);

    expect(created).toBeUndefined();
    expect(await getChatChannel(db, row.id)).toBeUndefined();
    expect((await getChatChannel(db, taken))?.eventId).toBe(taken);
  });

  it("moves the chat's lifetime with an edit that moves the meetup's end", async () => {
    const eventId = await publishMeetup(db);
    const event = await getEvent(db, eventId);
    const endsAt = new Date('2099-01-16T21:30:00Z');

    const changed = await updateEventIfCurrent(
      db,
      eventId,
      event?.version ?? 0,
      {
        startsAt: new Date('2099-01-16T19:00:00Z'),
        endsAt,
      },
    );

    expect(changed).toBe(1);
    expect(await getChatChannel(db, eventId)).toMatchObject({
      readOnlyAt: after(endsAt, CHAT_OPEN_AFTER_MEETUP_SECONDS),
      expiresAt: after(endsAt, CHAT_KEPT_AFTER_MEETUP_SECONDS),
    });
  });

  it('leaves the chat alone when an edit lost the race for the meetup', async () => {
    const eventId = await publishMeetup(db);
    const event = await getEvent(db, eventId);
    const before = await getChatChannel(db, eventId);

    const changed = await updateEventIfCurrent(
      db,
      eventId,
      (event?.version ?? 0) + 1,
      { endsAt: new Date('2099-03-01T20:00:00Z') },
    );

    expect(changed).toBe(0);
    expect(await getChatChannel(db, eventId)).toEqual(before);
  });

  it('turns the chat read-only the moment the meetup is cancelled', async () => {
    const eventId = await publishMeetup(db);

    const changed = await transitionEventStatus(
      db,
      eventId,
      'published',
      'cancelled',
    );

    const cancelledAt = (await getEvent(db, eventId))?.cancelledAt;
    expect(changed).toBe(1);
    expect(cancelledAt).toBeInstanceOf(Date);
    expect(await getChatChannel(db, eventId)).toMatchObject({
      readOnlyAt: cancelledAt,
      expiresAt: after(
        cancelledAt ?? new Date(0),
        CHAT_KEPT_AFTER_MEETUP_SECONDS,
      ),
    });
  });

  it('leaves the chat alone when the meetup was not in the status a transition expected', async () => {
    const eventId = await publishMeetup(db);
    const before = await getChatChannel(db, eventId);

    const changed = await transitionEventStatus(
      db,
      eventId,
      'cancelled',
      'published',
    );

    expect(changed).toBe(0);
    expect(await getChatChannel(db, eventId)).toEqual(before);
  });
});

describe('insertChatChannel and syncChatChannel (real D1)', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('heals a meetup published without a chat, once', async () => {
    const event = await createEvent(db, meetupRow());
    expect(await getChatChannel(db, event.id)).toBeUndefined();

    const first = await insertChatChannel(db, {
      id: id('chn'),
      eventId: event.id,
    });
    const second = await insertChatChannel(db, {
      id: id('chn'),
      eventId: event.id,
    });

    expect(changesOf(first)).toBe(1);
    expect(changesOf(second)).toBe(0);
    expect(await getChatChannel(db, event.id)).toMatchObject({
      readOnlyAt: after(ENDS_AT, CHAT_OPEN_AFTER_MEETUP_SECONDS),
    });
  });

  it('writes no chat for a meetup whose chat would already have been deleted', async () => {
    const endsAt = new Date(Date.now() - 100 * DAY_SECONDS * 1000);
    const event = await createEvent(
      db,
      meetupRow({ startsAt: after(endsAt, -2 * 60 * 60), endsAt }),
    );

    const result = await insertChatChannel(db, {
      id: id('chn'),
      eventId: event.id,
    });

    expect(changesOf(result)).toBe(0);
    expect(await getChatChannel(db, event.id)).toBeUndefined();
  });

  it('writes no chat for a meetup that is not there', async () => {
    const result = await insertChatChannel(db, {
      id: id('chn'),
      eventId: 'evt_never_published',
    });

    expect(changesOf(result)).toBe(0);
  });

  it('changes nothing for a chat already in line with its meetup', async () => {
    const eventId = await publishMeetup(db);

    expect(changesOf(await syncChatChannel(db, eventId))).toBe(0);
  });
});
