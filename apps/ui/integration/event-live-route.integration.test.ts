import {
  createExecutionContext,
  env,
  runDurableObjectAlarm,
  runInDurableObject,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import type { EventLiveDO } from '../src/durable-objects/EventLiveDO';
import worker from '../src/server';
import {
  connect,
  listen,
  liveRoomOf,
  ofType,
  seedLiveRoom,
  sessionCookie,
  typeOf,
  walkIn,
  type LiveClient,
  type LiveRoom,
} from './event-live.fixtures';

const ORIGIN = 'https://staging.founders.coffee';

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

/** A member of the meetup, admitted to its room. */
const memberIn = async (room: LiveRoom): Promise<LiveClient> => {
  const member = await connect(room.eventId, room.guestToken);
  await member.waitFor(ofType('auth_ok'));
  return member;
};

const storedEventId = (eventId: string) =>
  runInDurableObject(liveRoomOf(eventId), (_instance: EventLiveDO, state) =>
    state.storage.get<string>('eventId'),
  );

describe('the public route to a live room', () => {
  it('lets a member in on the upgrade a browser sends', async () => {
    const room = await seedLiveRoom();

    const member = listen(
      await fromOutside(`/api/live/${room.eventId}`, {
        headers: {
          Upgrade: 'websocket',
          Cookie: sessionCookie(room.guestToken),
        },
      }),
    );

    await member.waitFor(ofType('auth_ok'));
  });

  it('closes nobody out of the room for a POST dressed as a cancellation', async () => {
    const room = await seedLiveRoom();
    const member = await memberIn(room);

    const response = await fromOutside(`/api/live/${room.eventId}`, {
      method: 'POST',
      headers: { Upgrade: 'websocket', 'x-event-live-internal': '1' },
    });

    await walkIn(member, room.guestId);
    expect(
      member.frames.map(typeOf),
      'a member told the meetup is off stops reconnecting for good',
    ).not.toContain('event_cancelled');
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET');
  });

  it('turns a longer path away, and the room keeps its members', async () => {
    const room = await seedLiveRoom();
    const member = await memberIn(room);

    const response = await fromOutside(
      `/api/live/${room.eventId}/evt_elsewhere`,
      { headers: { Upgrade: 'websocket' } },
    );
    await runDurableObjectAlarm(liveRoomOf(room.eventId));

    await walkIn(member, room.guestId);
    expect(
      member.frames.map(typeOf),
      'a member told their session ended stops reconnecting for good',
    ).not.toContain('auth_expired');
    expect(response.status).toBe(404);
  });

  it("opens no socket for a longer path, whoever's session it carries", async () => {
    const room = await seedLiveRoom();
    const elsewhere = await seedLiveRoom();

    const response = await fromOutside(
      `/api/live/${room.eventId}/${elsewhere.eventId}`,
      {
        headers: {
          Upgrade: 'websocket',
          Cookie: sessionCookie(elsewhere.guestToken),
        },
      },
    );

    expect(response.webSocket).toBeNull();
    expect(response.status).toBe(404);
  });
});

describe('the room behind the route', () => {
  it('is cancelled by no request, not even the one the Worker used to send', async () => {
    const room = await seedLiveRoom();
    const member = await memberIn(room);

    const response = await liveRoomOf(room.eventId).fetch(
      new Request(
        `https://event-live.internal/internal/cancel/${room.eventId}`,
        { method: 'POST', headers: { 'x-event-live-internal': '1' } },
      ),
    );

    await walkIn(member, room.guestId);
    expect(member.frames.map(typeOf)).not.toContain('event_cancelled');
    expect(response.status).toBe(405);
  });

  it('keeps its own meetup when an upgrade names another', async () => {
    const room = await seedLiveRoom();
    await memberIn(room);

    const response = await liveRoomOf(room.eventId).fetch(
      new Request(`${ORIGIN}/api/live/${room.eventId}/evt_elsewhere`, {
        headers: { Upgrade: 'websocket' },
      }),
    );

    expect(response.webSocket).toBeNull();
    expect(await storedEventId(room.eventId)).toBe(room.eventId);
  });
});
