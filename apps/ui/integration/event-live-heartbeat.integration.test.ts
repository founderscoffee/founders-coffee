import {
  env,
  runDurableObjectAlarm,
  runInDurableObject,
} from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import type { EventLiveDO } from '../src/durable-objects/EventLiveDO';
import {
  HEARTBEAT_ACK_FRAME,
  HEARTBEAT_FRAME,
  HEARTBEAT_TIMEOUT_MS,
} from '../src/durable-objects/event-live/constants';
import {
  connect,
  liveRoomOf,
  ofType,
  seedLiveRoom,
  type LiveClient,
} from './event-live.fixtures';

const roomState = (eventId: string) =>
  runInDurableObject(
    liveRoomOf(eventId),
    async (instance: EventLiveDO, state) => ({
      tracked: instance['connections'].size(),
      alarm: await state.storage.getAlarm(),
      heartbeatAt: state
        .getWebSockets()
        .map(
          (socket) =>
            state.getWebSocketAutoResponseTimestamp(socket)?.getTime() ?? null,
        ),
    }),
  );

const admitted = async (
  eventId: string,
  sessionToken: string,
): Promise<LiveClient> => {
  const client = await connect(eventId, sessionToken);
  await client.waitFor(ofType('auth_ok'));
  await client.waitFor(ofType('roster_update'));
  return client;
};

const beat = async (client: LiveClient): Promise<void> => {
  client.socket.send(HEARTBEAT_FRAME);
  await client.waitFor((frame) => frame === HEARTBEAT_ACK_FRAME);
};

const registeredLongAgo = (eventId: string) =>
  runInDurableObject(liveRoomOf(eventId), (_instance: EventLiveDO, state) => {
    for (const socket of state.getWebSockets())
      socket.serializeAttachment({
        ...(socket.deserializeAttachment() as Record<string, unknown>),
        registeredAt: Date.now() - HEARTBEAT_TIMEOUT_MS,
      });
  });

const refusals = (client: LiveClient): readonly string[] =>
  client.frames.filter(
    (frame) => ofType('not_attending')(frame) || ofType('auth_expired')(frame),
  );

describe('the heartbeat (#85)', () => {
  it('is answered by the runtime, so the room never hears it', async () => {
    const room = await seedLiveRoom();
    const guest = await admitted(room.eventId, room.guestToken);

    guest.socket.send(HEARTBEAT_FRAME);
    guest.socket.send(JSON.stringify({ type: 'not_a_message' }));
    await guest.waitFor(ofType('error'));

    expect(guest.frames).toContain(HEARTBEAT_ACK_FRAME);
    expect(
      guest.frames
        .filter(ofType('error'))
        .map((frame) => (JSON.parse(frame) as { message: string }).message),
      'a heartbeat that reached the room would have drawn an error of its own',
    ).toEqual([expect.stringContaining('Invalid message')]);
    expect(
      (await roomState(room.eventId)).heartbeatAt,
      'only a heartbeat the runtime answered is stamped',
    ).toEqual([expect.any(Number)]);
  });

  it('does not reap a socket that has not had time for its first heartbeat', async () => {
    const room = await seedLiveRoom();
    await admitted(room.eventId, room.guestToken);

    expect(await runDurableObjectAlarm(liveRoomOf(room.eventId))).toBe(true);

    expect((await roomState(room.eventId)).tracked).toBe(1);
  });

  it('reaps a socket that never sent a heartbeat, a timeout after it was registered', async () => {
    const room = await seedLiveRoom();
    const guest = await admitted(room.eventId, room.guestToken);
    await registeredLongAgo(room.eventId);

    await runDurableObjectAlarm(liveRoomOf(room.eventId));

    expect(await guest.waitForClose()).toEqual({
      code: 4002,
      reason: 'heartbeat_timeout',
    });
  });

  it('keeps a socket that sent a heartbeat, however long ago it was registered', async () => {
    const room = await seedLiveRoom();
    const guest = await admitted(room.eventId, room.guestToken);
    await registeredLongAgo(room.eventId);
    await beat(guest);

    await runDurableObjectAlarm(liveRoomOf(room.eventId));

    expect((await roomState(room.eventId)).tracked).toBe(1);
  });
});

describe('the heartbeat alarm (#86)', () => {
  it('is set for when a new socket would go stale, not for the next tick', async () => {
    const room = await seedLiveRoom();
    const before = Date.now();
    await admitted(room.eventId, room.guestToken);
    const after = Date.now();

    const { alarm } = await roomState(room.eventId);

    expect(alarm).toBeGreaterThanOrEqual(before + HEARTBEAT_TIMEOUT_MS);
    expect(alarm).toBeLessThanOrEqual(after + HEARTBEAT_TIMEOUT_MS);
  });

  it('follows the oldest heartbeat in the room once it has run', async () => {
    const room = await seedLiveRoom();
    const host = await admitted(room.eventId, room.hostToken);
    const guest = await admitted(room.eventId, room.guestToken);
    await beat(host);
    await beat(guest);

    expect(await runDurableObjectAlarm(liveRoomOf(room.eventId))).toBe(true);

    const { alarm, heartbeatAt } = await roomState(room.eventId);
    const oldest = Math.min(...heartbeatAt.map((at) => at ?? Infinity));
    expect(alarm).toBe(oldest + HEARTBEAT_TIMEOUT_MS);
  });

  it('is deleted when the last socket leaves', async () => {
    const room = await seedLiveRoom();
    const guest = await admitted(room.eventId, room.guestToken);
    expect((await roomState(room.eventId)).alarm).not.toBeNull();

    guest.socket.close(1000, 'bye');

    await expect
      .poll(async () => (await roomState(room.eventId)).alarm, {
        timeout: 5_000,
      })
      .toBeNull();
  });
});

describe('revalidation, now in the alarm (#87)', () => {
  it('turns out a member whose RSVP was withdrawn, with nothing sent by them', async () => {
    const room = await seedLiveRoom();
    const host = await admitted(room.eventId, room.hostToken);
    const guest = await admitted(room.eventId, room.guestToken);
    await env.DB.prepare(
      "UPDATE event_rsvps SET status = 'cancelled' WHERE event_id = ? AND user_id = ?",
    )
      .bind(room.eventId, room.guestId)
      .run();

    expect(await runDurableObjectAlarm(liveRoomOf(room.eventId))).toBe(true);

    await guest.waitFor(ofType('not_attending'));
    expect(await guest.waitForClose()).toEqual({
      code: 4003,
      reason: 'not_attending',
    });
    expect(refusals(host), 'the host still holds').toEqual([]);
    expect((await roomState(room.eventId)).tracked).toBe(1);
  });

  it('turns out a session that has expired', async () => {
    const room = await seedLiveRoom();
    const guest = await admitted(room.eventId, room.guestToken);
    await env.DB.prepare(
      'UPDATE session SET expires_at = unixepoch() - 1 WHERE token = ?',
    )
      .bind(room.guestToken)
      .run();

    await runDurableObjectAlarm(liveRoomOf(room.eventId));

    await guest.waitFor(ofType('auth_expired'));
    expect(await guest.waitForClose()).toEqual({
      code: 4001,
      reason: 'auth_expired',
    });
  });

  it('turns nobody out, and tells nobody, when the database cannot answer', async () => {
    const room = await seedLiveRoom();
    const guest = await admitted(room.eventId, room.guestToken);
    await env.DB.prepare(
      'ALTER TABLE event_rsvps RENAME TO event_rsvps_away',
    ).run();
    try {
      expect(await runDurableObjectAlarm(liveRoomOf(room.eventId))).toBe(true);
    } finally {
      await env.DB.prepare(
        'ALTER TABLE event_rsvps_away RENAME TO event_rsvps',
      ).run();
    }
    await beat(guest);

    expect(
      guest.frames.filter(ofType('error')),
      'a check that could not run is no verdict, and anything the alarm sent arrives before the ack',
    ).toEqual([]);
    expect(refusals(guest)).toEqual([]);
    expect((await roomState(room.eventId)).tracked).toBe(1);
  });

  it('still checks a state-changing message before applying it', async () => {
    const room = await seedLiveRoom();
    const host = await admitted(room.eventId, room.hostToken);
    const guest = await admitted(room.eventId, room.guestToken);
    const rostersBefore = host.frames.filter(ofType('roster_update')).length;
    await env.DB.prepare(
      "UPDATE event_rsvps SET status = 'cancelled' WHERE event_id = ? AND user_id = ?",
    )
      .bind(room.eventId, room.guestId)
      .run();

    guest.socket.send(JSON.stringify({ type: 'walking_in' }));

    await guest.waitFor(ofType('not_attending'));
    expect(await guest.waitForClose()).toEqual({
      code: 4003,
      reason: 'not_attending',
    });
    expect(
      host.frames.filter(ofType('roster_update')).length,
      'the withdrawn member cannot move themselves in the roster',
    ).toBe(rostersBefore);
  });
});
