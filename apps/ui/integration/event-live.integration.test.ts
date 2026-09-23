import { evictDurableObject, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import type { EventLiveDO } from '../src/durable-objects/EventLiveDO';
import { connect, liveRoomOf, ofType } from './event-live.fixtures';

const trackedBy = (eventId: string) =>
  runInDurableObject(
    liveRoomOf(eventId),
    async (instance: EventLiveDO, state) => ({
      tracked: instance['connections'].size(),
      alarm: await state.storage.getAlarm(),
    }),
  );

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
