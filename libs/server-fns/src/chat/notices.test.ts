import { describe, expect, it } from 'vitest';

import { CHAT_ROOM_CLOSES } from '@founders-coffee/core';
import type { Db } from '@founders-coffee/db';

import { cancelEventResolver } from '../events/cancel.js';
import { setupDb, TEST_HOST_ID } from '../events/resolver.fixtures.js';
import {
  ACROSS_TOWN,
  apply,
  END,
  hostAnEvent,
  hostAnEventInAlgiers,
  START,
} from '../events/update.fixtures.js';
import { goingMember, switchChat } from './chat.fixtures.js';
import { readChatPageResolver } from './page.js';
import { connect, ofType, signIn } from './room.fixtures.js';
import type { ChatMessageView } from './view.js';

const HOUR_MS = 3_600_000;
const LATER = { startsAt: START + HOUR_MS, endsAt: END + HOUR_MS };

/** A database whose Algerian meetups have a chat, which the event fixtures' markets leave off. */
const setup = async (): Promise<Db> => {
  const db = await setupDb();
  await switchChat(db, 'DZ', true);
  return db;
};

/** The system messages a member reads when they open the meetup's chat, oldest first. */
const noticesFor = async (db: Db, eventId: string, viewerId = TEST_HOST_ID) => {
  const page = await readChatPageResolver(db, {
    eventId,
    viewerId,
    now: new Date(),
  });
  if (!page.ok) throw page.error;
  return page.data.messages
    .filter((message) => message.kind === 'system')
    .map(({ systemKey, systemParams }) => ({ systemKey, systemParams }));
};

describe("what a meetup's chat is told about the meetup (real D1 and Durable Objects via Miniflare)", () => {
  it('tells it the new start and where it is when the start moves, and pushes that to an open panel', async () => {
    const db = await setup();
    const event = await hostAnEvent(db);
    const host = await connect(event.id, await signIn(db, TEST_HOST_ID));

    expect((await apply(db, event, LATER)).ok).toBe(true);

    const rescheduled = {
      systemKey: 'rescheduled',
      systemParams: {
        startsAt: new Date(LATER.startsAt).toISOString(),
        venue: 'Café des Délices',
      },
    };
    expect(await noticesFor(db, event.id)).toEqual([rescheduled]);
    const pushed = JSON.parse(await host.waitFor(ofType('message'))) as {
      message: ChatMessageView;
    };
    expect(pushed.message).toMatchObject({
      kind: 'system',
      body: '',
      author: null,
      ...rescheduled,
    });
  });

  it('tells it the new place and its address when the café moves across town at the same start', async () => {
    const db = await setup();
    const event = await hostAnEventInAlgiers(db);

    expect((await apply(db, event, ACROSS_TOWN)).ok).toBe(true);

    expect(await noticesFor(db, event.id)).toEqual([
      {
        systemKey: 'relocated',
        systemParams: {
          venue: 'Café des Délices',
          address: '12 Rue des Entrepreneurs, Alger',
        },
      },
    ]);
  });

  it('tells it once, as a new start, when the time and the place move together', async () => {
    const db = await setup();
    const event = await hostAnEventInAlgiers(db);

    expect((await apply(db, event, { ...ACROSS_TOWN, ...LATER })).ok).toBe(
      true,
    );

    expect(
      (await noticesFor(db, event.id)).map((notice) => notice.systemKey),
    ).toEqual(['rescheduled']);
  });

  it('tells it nothing about an edit nobody going is told about', async () => {
    const db = await setup();
    const event = await hostAnEvent(db);

    expect((await apply(db, event, { title: 'Just a better title' })).ok).toBe(
      true,
    );

    expect(await noticesFor(db, event.id)).toEqual([]);
  });

  it("tells it the meetup is off, with the host's reason, before the room closes on the members in it", async () => {
    const db = await setup();
    const event = await hostAnEvent(db);
    const member = await goingMember(db, event.id);
    const guest = await connect(event.id, await signIn(db, member));

    const cancelled = await cancelEventResolver(db, {
      eventId: event.id,
      actorId: TEST_HOST_ID,
      reason: '  Le café ferme ce soir.  ',
    });

    expect(cancelled.ok).toBe(true);
    expect(await guest.waitForClose()).toEqual(CHAT_ROOM_CLOSES.closed);
    expect(
      guest.frames.map((frame) => (JSON.parse(frame) as { type: string }).type),
      'a panel hears why before it is told the chat has closed',
    ).toEqual(['message', 'closed']);
    expect(await noticesFor(db, event.id, member)).toEqual([
      {
        systemKey: 'cancelled',
        systemParams: { reason: 'Le café ferme ce soir.' },
      },
    ]);
  });

  it('tells it once, with no reason when the host gave none, however often the meetup is called off', async () => {
    const db = await setup();
    const event = await hostAnEvent(db);

    for (const attempt of [1, 2])
      expect(
        (
          await cancelEventResolver(db, {
            eventId: event.id,
            actorId: TEST_HOST_ID,
          })
        ).ok,
        `cancellation ${attempt}`,
      ).toBe(true);

    expect(await noticesFor(db, event.id)).toEqual([
      { systemKey: 'cancelled', systemParams: {} },
    ]);
  });

  it('tells a chat its market has not switched on nothing, so nothing is waiting when it is', async () => {
    const db = await setupDb();
    const event = await hostAnEvent(db);

    expect((await apply(db, event, LATER)).ok).toBe(true);
    expect(
      (
        await cancelEventResolver(db, {
          eventId: event.id,
          actorId: TEST_HOST_ID,
        })
      ).ok,
    ).toBe(true);

    await switchChat(db, 'DZ', true);
    expect(await noticesFor(db, event.id)).toEqual([]);
  });
});
