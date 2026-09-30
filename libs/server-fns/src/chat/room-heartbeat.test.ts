import { runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  CHAT_ROOM_CLOSES,
  HEARTBEAT_ACK_FRAME,
  HEARTBEAT_FRAME,
  HEARTBEAT_TIMEOUT_MS,
  ROOM_HEARTBEAT_TIMEOUT_CLOSE,
  ROOM_TRY_AGAIN_LATER_CLOSE,
} from '@founders-coffee/core';
import { sql, type Db } from '@founders-coffee/db';

import { ban, goingMember, publishMeetup, setupDb } from './chat.fixtures.js';
import type { EventChatDO } from './room-do.js';
import {
  connect,
  membersIn,
  ofType,
  registeredLongAgo,
  roomOf,
  signIn,
  type ChatClient,
} from './room.fixtures.js';

const beat = async (client: ChatClient): Promise<void> => {
  client.socket.send(HEARTBEAT_FRAME);
  await client.waitFor((frame) => frame === HEARTBEAT_ACK_FRAME);
};

const alarmOf = (eventId: string) =>
  runInDurableObject(roomOf(eventId), (_instance: EventChatDO, state) =>
    state.storage.getAlarm(),
  );

/**
 * Run `act` while D1 fails the room's membership query, then give the table back.
 *
 * With a table the query reads renamed away, D1 itself refuses the query, as it would in an outage,
 * and nothing is mocked.
 */
const whileD1Fails = async <T>(act: () => Promise<T>): Promise<T> => {
  const db = (env as unknown as { DB: D1Database }).DB;
  await db
    .prepare('ALTER TABLE event_rsvps RENAME TO event_rsvps_offline')
    .run();
  try {
    return await act();
  } finally {
    await db
      .prepare('ALTER TABLE event_rsvps_offline RENAME TO event_rsvps')
      .run();
  }
};

describe("a chat room's heartbeat (real D1 and Durable Objects via Miniflare)", () => {
  let db: Db;
  let eventId: string;
  let member: string;

  beforeEach(async () => {
    db = await setupDb();
    eventId = await publishMeetup(db);
    member = await goingMember(db, eventId);
  });

  it('is answered by the runtime, and nothing else a page sends gets an answer', async () => {
    const guest = await connect(eventId, await signIn(db, member));

    guest.socket.send(JSON.stringify({ type: 'message', body: 'Salam' }));
    await beat(guest);

    expect(guest.frames).toEqual([HEARTBEAT_ACK_FRAME]);
    expect(await membersIn(eventId)).toEqual([member]);
  });

  it('reaps a socket that stopped sending heartbeats, and keeps one that still does', async () => {
    const quiet = await connect(eventId, await signIn(db, member));
    const beating = await connect(eventId, await signIn(db, member));
    await registeredLongAgo(eventId, HEARTBEAT_TIMEOUT_MS);
    await beat(beating);

    expect(await runDurableObjectAlarm(roomOf(eventId))).toBe(true);

    expect(await quiet.waitForClose()).toEqual(ROOM_HEARTBEAT_TIMEOUT_CLOSE);
    expect(await membersIn(eventId)).toEqual([member]);
  });

  it('turns out a member banned since they joined, with nothing sent by them', async () => {
    const guest = await connect(eventId, await signIn(db, member));
    await ban(db, member);

    await runDurableObjectAlarm(roomOf(eventId));

    await guest.waitFor(ofType('revoked'));
    expect(await guest.waitForClose()).toEqual(CHAT_ROOM_CLOSES.revoked);
  });

  it('turns out a session that has ended, telling the page to sign in again', async () => {
    const token = await signIn(db, member);
    const guest = await connect(eventId, token);
    await db.run(
      sql`UPDATE session SET expires_at = unixepoch() - 1 WHERE token = ${token}`,
    );

    await runDurableObjectAlarm(roomOf(eventId));

    expect(await guest.waitForClose()).toEqual(CHAT_ROOM_CLOSES.noSession);
  });

  it('turns nobody out when the database cannot answer, and asks a joining page to try again', async () => {
    const guest = await connect(eventId, await signIn(db, member));
    const token = await signIn(db, member);

    const joining = await whileD1Fails(async () => {
      await runDurableObjectAlarm(roomOf(eventId));
      return connect(eventId, token);
    });

    expect(await joining.waitForClose()).toEqual(ROOM_TRY_AGAIN_LATER_CLOSE);
    await beat(guest);
    expect(guest.frames).toEqual([HEARTBEAT_ACK_FRAME]);
    expect(await membersIn(eventId)).toEqual([member]);
  });

  it('keeps its alarm for when the first socket could go stale, and drops it when the room empties', async () => {
    const before = Date.now();
    const guest = await connect(eventId, await signIn(db, member));
    const after = Date.now();

    const armed = await alarmOf(eventId);
    expect(armed).toBeGreaterThanOrEqual(before + HEARTBEAT_TIMEOUT_MS);
    expect(armed).toBeLessThanOrEqual(after + HEARTBEAT_TIMEOUT_MS);

    guest.socket.close(1000, 'bye');
    await expect.poll(() => alarmOf(eventId), { timeout: 5_000 }).toBeNull();
  });
});
