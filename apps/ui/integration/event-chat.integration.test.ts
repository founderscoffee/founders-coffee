import {
  createExecutionContext,
  env,
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import {
  CHAT_ROOM_CLOSES,
  HEARTBEAT_TIMEOUT_MS,
  ROOM_HEARTBEAT_TIMEOUT_CLOSE,
} from '@founders-coffee/core';
import type { EventChatDO } from '@founders-coffee/server-fns/chat-room';

import worker from '../src/server';
import {
  listen,
  ofType,
  seedLiveRoom,
  sessionCookie,
  type LiveClient,
} from './event-live.fixtures';

const ORIGIN = 'https://staging.founders.coffee';

/** The room of a meetup's chat, addressed by the name the route and the server functions use. */
const chatRoomOf = (eventId: string): DurableObjectStub<EventChatDO> => {
  const namespace = env.EVENT_CHAT as DurableObjectNamespace<EventChatDO>;
  return namespace.get(namespace.idFromName(`chat:${eventId}`));
};

/** Send a request the way any client on the internet can: to the Worker, through `server.ts`. */
const fromOutside = async (
  pathname: string,
  init: RequestInit = {},
): Promise<Response> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(`${ORIGIN}${pathname}`, init),
    env,
    context,
  );
  await waitOnExecutionContext(context);
  return response;
};

/** The upgrade a browser sends from the site's own pages, signed in with `sessionToken`. */
const browserUpgrade = (
  sessionToken: string,
  headers: Record<string, string> = {},
): RequestInit => ({
  headers: {
    Upgrade: 'websocket',
    Origin: ORIGIN,
    'Sec-Fetch-Site': 'same-origin',
    'cf-connecting-ip': `198.51.100.${Math.floor(Math.random() * 250) + 1}`,
    Cookie: sessionCookie(sessionToken),
    ...headers,
  },
});

const joinChat = async (
  eventId: string,
  sessionToken: string,
): Promise<LiveClient> =>
  listen(
    await fromOutside(`/api/chat/${eventId}`, browserUpgrade(sessionToken)),
  );

const heldBy = (eventId: string): Promise<readonly string[]> =>
  runInDurableObject(chatRoomOf(eventId), (instance: EventChatDO) =>
    instance['connections'].members().map(([, member]) => member.userId),
  );

/** A tombstone pushed to the room as a removal pushes it, and waited for on `client`. */
const pushAndHear = async (
  eventId: string,
  client: LiveClient,
): Promise<void> => {
  const id = `msg_${crypto.randomUUID()}`;
  await chatRoomOf(eventId).broadcast({ type: 'removed', id, removal: 'host' });
  await client.waitFor(
    (frame) => ofType('removed')(frame) && frame.includes(id),
  );
};

describe("the public route to a meetup's chat room", () => {
  it('lets a member in on the upgrade their browser sends from the site', async () => {
    const room = await seedLiveRoom();

    const member = await joinChat(room.eventId, room.guestToken);

    await pushAndHear(room.eventId, member);
    expect(await heldBy(room.eventId)).toEqual([room.guestId]);
  });

  it('turns away a socket another site opens, and lets nothing reach the room', async () => {
    const room = await seedLiveRoom();

    const response = await fromOutside(
      `/api/chat/${room.eventId}`,
      browserUpgrade(room.guestToken, { Origin: 'https://elsewhere.example' }),
    );

    expect(response.status).toBe(403);
    expect(response.webSocket).toBeNull();
    expect(await heldBy(room.eventId)).toEqual([]);
  });

  it('turns away a POST and a path that names more than a meetup', async () => {
    const room = await seedLiveRoom();

    const posted = await fromOutside(`/api/chat/${room.eventId}`, {
      ...browserUpgrade(room.guestToken),
      method: 'POST',
    });
    const longer = await fromOutside(
      `/api/chat/${room.eventId}/evt_elsewhere`,
      browserUpgrade(room.guestToken),
    );

    expect(posted.status).toBe(405);
    expect(posted.headers.get('Allow')).toBe('GET');
    expect(longer.status).toBe(404);
  });

  it('refuses a signed-in reader who is not going, and says so', async () => {
    const room = await seedLiveRoom();
    const elsewhere = await seedLiveRoom();

    const outsider = await joinChat(room.eventId, elsewhere.guestToken);

    await outsider.waitFor(ofType('revoked'));
    expect(await outsider.waitForClose()).toEqual(CHAT_ROOM_CLOSES.revoked);
  });
});

describe('a chat room reached through the Worker', () => {
  it('turns out a member whose RSVP is cancelled when a server function asks it to', async () => {
    const room = await seedLiveRoom();
    const member = await joinChat(room.eventId, room.guestToken);
    await env.DB.prepare(
      'DELETE FROM event_rsvps WHERE event_id = ? AND user_id = ?',
    )
      .bind(room.eventId, room.guestId)
      .run();

    await chatRoomOf(room.eventId).revoke(room.guestId);

    await member.waitFor(ofType('revoked'));
    expect(await member.waitForClose()).toEqual(CHAT_ROOM_CLOSES.revoked);
  });

  it('reaps a socket that stopped sending heartbeats', async () => {
    const room = await seedLiveRoom();
    const member = await joinChat(room.eventId, room.guestToken);
    await runInDurableObject(
      chatRoomOf(room.eventId),
      (_instance: EventChatDO, state) => {
        for (const socket of state.getWebSockets())
          socket.serializeAttachment({
            ...(socket.deserializeAttachment() as Record<string, unknown>),
            registeredAt: Date.now() - HEARTBEAT_TIMEOUT_MS,
          });
      },
    );

    expect(await runDurableObjectAlarm(chatRoomOf(room.eventId))).toBe(true);

    expect(await member.waitForClose()).toEqual(ROOM_HEARTBEAT_TIMEOUT_CLOSE);
  });

  it('wakes from hibernation with its members and pushes to them', async () => {
    const room = await seedLiveRoom();
    const member = await joinChat(room.eventId, room.guestToken);

    await evictDurableObject(chatRoomOf(room.eventId));

    await pushAndHear(room.eventId, member);
    expect(await heldBy(room.eventId)).toEqual([room.guestId]);
  });
});
