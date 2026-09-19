import { env, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import type { EventLiveDO } from '../src/durable-objects/EventLiveDO';

const namespace = env.EVENT_LIVE;

const objectFor = (eventId: string) =>
  namespace.get(namespace.idFromName(`event:${eventId}`));

const upgrade = (eventId: string): Request =>
  new Request(`https://staging.founders.coffee/api/live/${eventId}`, {
    headers: { Upgrade: 'websocket' },
  });

describe('EventLiveDO', () => {
  it('upgrades a live connection and persists the event identity', async () => {
    const eventId = `evt_live_no_session_${crypto.randomUUID()}`;
    const response = await objectFor(eventId).fetch(upgrade(eventId));

    expect(response.status).toBe(101);
    const client = response.webSocket;
    expect(client).toBeDefined();
    client?.accept();
    client?.close();

    const stored = await runInDurableObject(
      objectFor(eventId),
      async (_instance: EventLiveDO, state) => ({
        eventId: await state.storage.get<string>('eventId'),
      }),
    );
    expect(stored).toEqual({ eventId });
  });

  it('stores the event identity and clears the heartbeat alarm on cancellation', async () => {
    const eventId = `evt_live_cancel_${crypto.randomUUID()}`;
    const response = await objectFor(eventId).fetch(
      new Request(`https://event-live.internal/internal/cancel/${eventId}`, {
        method: 'POST',
        headers: { 'x-event-live-internal': '1' },
      }),
    );

    expect(response.status).toBe(204);
    const stored = await runInDurableObject(
      objectFor(eventId),
      async (_instance: EventLiveDO, state) => ({
        eventId: await state.storage.get<string>('eventId'),
        alarm: await state.storage.getAlarm(),
      }),
    );
    expect(stored).toEqual({ eventId, alarm: null });
  });
});
