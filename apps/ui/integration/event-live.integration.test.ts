import { env, evictDurableObject, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import type { EventLiveDO } from '../src/durable-objects/EventLiveDO';
import {
  connect,
  liveRoomOf,
  ofType,
  seedLiveRoom,
  type LiveClient,
} from './event-live.fixtures';

const trackedBy = (eventId: string) =>
  runInDurableObject(
    liveRoomOf(eventId),
    async (instance: EventLiveDO, state) => ({
      tracked: instance['connections'].size(),
      alarm: await state.storage.getAlarm(),
    }),
  );

const typeOf = (frame: string): unknown =>
  (JSON.parse(frame) as { type?: unknown }).type;

const admitted = async (
  eventId: string,
  sessionToken: string,
): Promise<LiveClient> => {
  const client = await connect(eventId, sessionToken);
  await client.waitFor(ofType('auth_ok'));
  return client;
};

const cancelMeetup = (eventId: string) =>
  liveRoomOf(eventId).fetch(
    new Request(`https://event-live.internal/internal/cancel/${eventId}`, {
      method: 'POST',
      headers: { 'x-event-live-internal': '1' },
    }),
  );

/**
 * Put a socket in the room as its upgrade does while D1 checks its session: accepted and
 * registered, not verified.
 *
 * It is made rather than caught. In production the room goes on serving other sockets during that
 * check, but a local D1 answers without yielding, so no broadcast can land inside a real one here.
 * The pair is made inside the object, because a socket cannot cross into the test, and its client
 * end is read there too. Every frame it hears lands in the list returned.
 */
const unverifiedSocketIn = async (
  eventId: string,
): Promise<readonly string[]> => {
  const heard: string[] = [];
  await runInDurableObject(
    liveRoomOf(eventId),
    (instance: EventLiveDO, state) => {
      const pair = new WebSocketPair();
      const [client, server] = [pair[0], pair[1]];
      state.acceptWebSocket(server);
      instance['connections'].register(server, Date.now());
      client.accept();
      client.addEventListener('message', (event) => {
        heard.push(String(event.data));
      });
    },
  );
  return heard;
};

/**
 * Run `act` while D1 fails the room's membership query, then give the table back.
 *
 * With a table the query reads renamed away, D1 itself refuses the query, as it would in an outage,
 * and nothing is mocked.
 */
const whileD1Fails = async <T>(act: () => Promise<T>): Promise<T> => {
  await env.DB.prepare(
    'ALTER TABLE event_rsvps RENAME TO event_rsvps_offline',
  ).run();
  try {
    return await act();
  } finally {
    await env.DB.prepare(
      'ALTER TABLE event_rsvps_offline RENAME TO event_rsvps',
    ).run();
  }
};

describe('EventLiveDO', () => {
  it('upgrades a live connection and persists the event identity', async () => {
    const eventId = `evt_live_no_session_${crypto.randomUUID()}`;
    const client = await connect(eventId);
    client.socket.close();

    const stored = await runInDurableObject(
      liveRoomOf(eventId),
      async (_instance: EventLiveDO, state) => ({
        eventId: await state.storage.get<string>('eventId'),
      }),
    );
    expect(stored).toEqual({ eventId });
  });

  it('stores the event identity and clears the heartbeat alarm on cancellation', async () => {
    const eventId = `evt_live_cancel_${crypto.randomUUID()}`;
    const response = await liveRoomOf(eventId).fetch(
      new Request(`https://event-live.internal/internal/cancel/${eventId}`, {
        method: 'POST',
        headers: { 'x-event-live-internal': '1' },
      }),
    );

    expect(response.status).toBe(204);
    const stored = await runInDurableObject(
      liveRoomOf(eventId),
      async (_instance: EventLiveDO, state) => ({
        eventId: await state.storage.get<string>('eventId'),
        alarm: await state.storage.getAlarm(),
      }),
    );
    expect(stored).toEqual({ eventId, alarm: null });
  });
});

describe('a refused connection (#84)', () => {
  it('is forgotten as it is refused, and the alarm goes with it', async () => {
    const eventId = `evt_live_refused_${crypto.randomUUID()}`;
    const client = await connect(eventId);
    await client.waitFor(ofType('auth_expired'));

    expect(
      await trackedBy(eventId),
      'nothing is left in the room, so nothing should wake it',
    ).toEqual({ tracked: 0, alarm: null });
  });

  it('is not brought back when the object wakes, though its client never answered the close', async () => {
    const eventId = `evt_live_ghost_${crypto.randomUUID()}`;
    const client = await connect(eventId);
    await client.waitFor(ofType('auth_expired'));
    const held = await runInDurableObject(
      liveRoomOf(eventId),
      (_instance: EventLiveDO, state) =>
        state.getWebSockets().map((socket) => socket.readyState),
    );
    expect(held, 'the runtime still holds the half-closed socket').toEqual([
      WebSocket.CLOSING,
    ]);

    await evictDurableObject(liveRoomOf(eventId));

    expect((await trackedBy(eventId)).tracked).toBe(0);
  });
});

describe('a socket the room has not verified', () => {
  it('hears nothing the room tells its members, only that the meetup is off', async () => {
    const room = await seedLiveRoom();
    const heard = await unverifiedSocketIn(room.eventId);
    const host = await admitted(room.eventId, room.hostToken);

    host.socket.send(
      JSON.stringify({
        type: 'arrived',
        tableNumber: 7,
        visualCue: 'Red scarf',
      }),
    );
    await host.waitFor((frame) => frame.includes('"tableNumber":7'));
    await cancelMeetup(room.eventId);
    await expect
      .poll(
        () => heard.some(ofType('event_cancelled')),
        'the cancellation is for every socket in the room',
      )
      .toBe(true);

    expect(
      heard.map(typeOf),
      'the roster and where the host sits went to verified sockets alone',
    ).toEqual(['event_cancelled']);
  });
});

describe('a connection whose session could not be checked', () => {
  it('is closed rather than left in the room unverified', async () => {
    const room = await seedLiveRoom();

    const refused = await whileD1Fails(() =>
      connect(room.eventId, room.guestToken),
    );
    await refused.waitForClose();

    expect(
      await trackedBy(room.eventId),
      'nothing unverified stays behind to hear the room',
    ).toEqual({ tracked: 0, alarm: null });
  });
});
