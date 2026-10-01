import {
  env,
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject,
} from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import type { EventLiveDO } from '../src/durable-objects/EventLiveDO';
import {
  connect,
  liveRoomOf,
  ofType,
  seedLiveRoom,
  typeOf,
  walkIn,
  whileD1Fails,
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

const admitted = async (
  eventId: string,
  sessionToken: string,
): Promise<LiveClient> => {
  const client = await connect(eventId, sessionToken);
  await client.waitFor(ofType('auth_ok'));
  return client;
};

const cancelMeetup = (eventId: string): Promise<void> =>
  liveRoomOf(eventId).cancel();

/** Cancel a meetup in D1 alone, as a Worker with no binding to the room does. */
const cancelledInD1 = async (eventId: string): Promise<void> => {
  await env.DB.prepare("UPDATE events SET status = 'cancelled' WHERE id = ?")
    .bind(eventId)
    .run();
};

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

  it("closes a member's socket and clears the heartbeat alarm on cancellation", async () => {
    const room = await seedLiveRoom();
    const guest = await admitted(room.eventId, room.guestToken);

    await cancelMeetup(room.eventId);

    expect(await guest.waitForClose()).toEqual({
      code: 4003,
      reason: 'event_cancelled',
    });
    expect(guest.frames.filter(ofType('event_cancelled'))).toHaveLength(1);
    expect(await trackedBy(room.eventId)).toEqual({ tracked: 0, alarm: null });
  });

  it('closes at its next alarm for a meetup cancelled where it was not told, as the nightly account closure cancels', async () => {
    const room = await seedLiveRoom();
    const guest = await admitted(room.eventId, room.guestToken);
    await cancelledInD1(room.eventId);

    expect(await runDurableObjectAlarm(liveRoomOf(room.eventId))).toBe(true);

    await guest.waitFor(ofType('event_cancelled'));
    expect(await guest.waitForClose()).toEqual({
      code: 4003,
      reason: 'event_cancelled',
    });
    expect(await trackedBy(room.eventId)).toEqual({ tracked: 0, alarm: null });
  });

  it('turns a page away from the room of a cancelled meetup, saying it is off', async () => {
    const room = await seedLiveRoom();
    await cancelledInD1(room.eventId);

    const guest = await connect(room.eventId, room.guestToken);

    await guest.waitFor(ofType('event_cancelled'));
    expect(await guest.waitForClose()).toEqual({
      code: 4003,
      reason: 'event_cancelled',
    });
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

  it('is asked to try again, not told its session expired, and let in when it does', async () => {
    const room = await seedLiveRoom();

    const refused = await whileD1Fails(() =>
      connect(room.eventId, room.guestToken),
    );

    expect(await refused.waitForClose()).toEqual({
      code: 1013,
      reason: 'try_again_later',
    });
    expect(
      refused.frames.map(typeOf),
      'no verdict the browser would stop reconnecting for',
    ).toEqual(['error']);
    const retried = await connect(room.eventId, room.guestToken);
    await retried.waitFor(ofType('auth_ok'));
  });
});

describe('a connection whose session has ended', () => {
  it('is still told so as it joins', async () => {
    const room = await seedLiveRoom();
    await env.DB.prepare(
      'UPDATE session SET expires_at = unixepoch() - 1 WHERE token = ?',
    )
      .bind(room.guestToken)
      .run();

    const refused = await connect(room.eventId, room.guestToken);

    await refused.waitFor(ofType('auth_expired'));
    expect(await refused.waitForClose()).toEqual({
      code: 4001,
      reason: 'auth_expired',
    });
  });
});

describe('a verified connection the database cannot answer for', () => {
  it('stays in the room when a message finds the database down', async () => {
    const room = await seedLiveRoom();
    const guest = await admitted(room.eventId, room.guestToken);

    await whileD1Fails(async () => {
      guest.socket.send(JSON.stringify({ type: 'walking_in' }));
      await guest.waitFor(ofType('error'));
    });

    expect((await trackedBy(room.eventId)).tracked).toBe(1);
    await walkIn(guest, room.guestId);
  });

  it('stays in the room when an auth frame finds the database down', async () => {
    const room = await seedLiveRoom();
    const guest = await admitted(room.eventId, room.guestToken);

    await whileD1Fails(async () => {
      guest.socket.send(
        JSON.stringify({ type: 'auth', sessionToken: room.guestToken }),
      );
      await guest.waitFor(ofType('error'));
    });

    expect((await trackedBy(room.eventId)).tracked).toBe(1);
    await walkIn(guest, room.guestId);
  });
});
