import { evictDurableObject } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { CHAT_ROOM_CLOSES, id } from '@founders-coffee/core';
import { createRsvp, type Db } from '@founders-coffee/db';

import { cancelEventResolver } from '../events/cancel.js';
import { cancelRsvpResolver } from '../rsvps/resolver.js';
import {
  goingMember,
  HOST_ID,
  newMember,
  publishMeetup,
  setupDb,
} from './chat.fixtures.js';
import {
  removeChatMessageResolver,
  sendChatMessageResolver,
} from './messages.js';
import {
  connect,
  membersIn,
  ofType,
  roomOf,
  signIn,
  type ChatClient,
} from './room.fixtures.js';

type MessageFrame = {
  type: 'message';
  message: { id: string; isOwn: boolean; clientId: string | null };
};

const messageIn = (client: ChatClient, messageId: string) =>
  client.waitFor(
    (frame) =>
      ofType('message')(frame) &&
      (JSON.parse(frame) as MessageFrame).message.id === messageId,
  );

describe("a meetup chat's room (real D1 and Durable Objects via Miniflare)", () => {
  let db: Db;
  let eventId: string;

  beforeEach(async () => {
    db = await setupDb();
    eventId = await publishMeetup(db);
  });

  const send = async (authorId: string, clientId = crypto.randomUUID()) => {
    const sent = await sendChatMessageResolver(db, {
      eventId,
      authorId,
      body: 'Salam',
      clientId,
    });
    if (!sent.ok) throw sent.error;
    return sent.data;
  };

  it('pushes a message to the host and the people going, each as their own screen shows it', async () => {
    const member = await goingMember(db, eventId);
    const host = await connect(eventId, await signIn(db, HOST_ID));
    const author = await connect(eventId, await signIn(db, member));
    const clientId = crypto.randomUUID();

    const sent = await send(member, clientId);

    const forAuthor = JSON.parse(await messageIn(author, sent.id)) as {
      message: Record<string, unknown>;
    };
    const forHost = JSON.parse(await messageIn(host, sent.id)) as {
      message: Record<string, unknown>;
    };
    expect(forAuthor.message).toMatchObject({ isOwn: true, clientId });
    expect(forHost.message).toMatchObject({
      isOwn: false,
      clientId: null,
      body: 'Salam',
      author: { id: member },
    });
    expect(host.frames.join()).not.toContain('@chat.test');
  });

  it('turns away someone who is not going, and someone with no session, each with their own close', async () => {
    const stranger = await connect(
      eventId,
      await signIn(db, await newMember(db)),
    );
    const signedOut = await connect(eventId);

    await stranger.waitFor(ofType('revoked'));
    expect(await stranger.waitForClose()).toEqual(CHAT_ROOM_CLOSES.revoked);
    expect(await signedOut.waitForClose()).toEqual(CHAT_ROOM_CLOSES.noSession);
    expect(signedOut.frames).toEqual([]);
    expect(await membersIn(eventId)).toEqual([]);
  });

  it("closes a member's sockets when they cancel their RSVP, and leaves everyone else's", async () => {
    const member = await goingMember(db, eventId);
    const other = await goingMember(db, eventId);
    const leaving = await connect(eventId, await signIn(db, member));
    const staying = await connect(eventId, await signIn(db, other));

    const cancelled = await cancelRsvpResolver(db, { eventId, userId: member });

    expect(cancelled.ok).toBe(true);
    await leaving.waitFor(ofType('revoked'));
    expect(await leaving.waitForClose()).toEqual(CHAT_ROOM_CLOSES.revoked);
    expect(await membersIn(eventId)).toEqual([other]);
    expect(staying.frames).toEqual([]);
  });

  it("keeps the host's sockets when the host's own RSVP goes, since hosting is what makes them a member", async () => {
    await createRsvp(db, { id: id('rsv'), eventId, userId: HOST_ID });
    const host = await connect(eventId, await signIn(db, HOST_ID));

    const cancelled = await cancelRsvpResolver(db, {
      eventId,
      userId: HOST_ID,
    });

    expect(cancelled.ok).toBe(true);
    expect(await membersIn(eventId)).toEqual([HOST_ID]);
    expect(host.frames).toEqual([]);
  });

  it('pushes the tombstone of a removed message', async () => {
    const member = await goingMember(db, eventId);
    const host = await connect(eventId, await signIn(db, HOST_ID));
    const sent = await send(member);

    await removeChatMessageResolver(db, {
      messageId: sent.id,
      actorId: HOST_ID,
    });

    expect(JSON.parse(await host.waitFor(ofType('removed')))).toEqual({
      type: 'removed',
      id: sent.id,
      removal: 'host',
    });
  });

  it('closes every socket when the meetup is cancelled', async () => {
    const member = await goingMember(db, eventId);
    const host = await connect(eventId, await signIn(db, HOST_ID));
    const guest = await connect(eventId, await signIn(db, member));

    const cancelled = await cancelEventResolver(db, {
      eventId,
      actorId: HOST_ID,
    });

    expect(cancelled.ok).toBe(true);
    for (const client of [host, guest]) {
      await client.waitFor(ofType('closed'));
      expect(await client.waitForClose()).toEqual(CHAT_ROOM_CLOSES.closed);
    }
    expect(await membersIn(eventId)).toEqual([]);
  });

  it("lets the oldest of a member's sockets give way to a sixth", async () => {
    const member = await goingMember(db, eventId);
    const token = await signIn(db, member);
    const sockets: ChatClient[] = [];
    for (let n = 0; n < 6; n += 1) sockets.push(await connect(eventId, token));

    expect(await sockets[0]?.waitForClose()).toEqual(
      CHAT_ROOM_CLOSES.superseded,
    );
    expect(await membersIn(eventId)).toHaveLength(5);
  });

  it('wakes from hibernation with its members, and pushes to them', async () => {
    const member = await goingMember(db, eventId);
    const guest = await connect(eventId, await signIn(db, member));

    await evictDurableObject(roomOf(eventId));
    const sent = await send(HOST_ID);

    await messageIn(guest, sent.id);
    expect(await membersIn(eventId)).toEqual([member]);
  });
});
