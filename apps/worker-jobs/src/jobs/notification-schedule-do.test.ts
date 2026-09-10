import { env, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import type { NotificationScheduleDO } from './notification-schedule-do.js';
import { REARM_FLOOR_MS } from './notification-schedule-do.js';
import { EVENT_ID, enqueue, setupDb } from './notification-sweep.fixtures.js';

type ScheduleDO = NotificationScheduleDO & {
  arm: (opts: { eventId: string; sendAtMs: number }) => Promise<void>;
};

const objectFor = (name: string) => {
  const namespace = env.NOTIFICATION_SCHEDULE;
  return namespace.get(namespace.idFromName(name));
};

const alarmOf = async (name: string): Promise<number | null> =>
  runInDurableObject(objectFor(name), async (_instance, state) =>
    state.storage.getAlarm(),
  );

const armObject = async (name: string, sendAtMs: number): Promise<void> => {
  await runInDurableObject(objectFor(name), async (instance: ScheduleDO) => {
    await instance.arm({ eventId: name, sendAtMs });
  });
};

const fireAlarm = async (name: string): Promise<void> => {
  await runInDurableObject(objectFor(name), async (instance: ScheduleDO) => {
    await instance.alarm();
  });
};

describe('NotificationScheduleDO', () => {
  it('arms an alarm at the moment the notification is due', async () => {
    const at = Date.now() + 60 * 60 * 1000;

    await armObject('evt_arm_future', at);

    expect(await alarmOf('evt_arm_future')).toBe(at);
  });

  it('keeps the earlier of two arms, so a reminder cannot bury a confirmation', async () => {
    const soon = Date.now() + 60 * 1000;
    const later = Date.now() + 24 * 60 * 60 * 1000;

    await armObject('evt_arm_order', later);
    await armObject('evt_arm_order', soon);
    await armObject('evt_arm_order', later);

    expect(await alarmOf('evt_arm_order')).toBe(soon);
  });

  it('treats a time already past as now rather than refusing it', async () => {
    const before = Date.now();

    const alarm = await runInDurableObject(
      objectFor('evt_arm_past'),
      async (instance: ScheduleDO, state) => {
        await instance.arm({
          eventId: 'evt_arm_past',
          sendAtMs: before - 60 * 60 * 1000,
        });
        return state.storage.getAlarm();
      },
    );

    expect(alarm).not.toBeNull();
    expect(alarm as number).toBeGreaterThanOrEqual(before);
  });

  it('announces the event on the queue when it fires', async () => {
    const db = await setupDb();
    await enqueue(db);
    await armObject(EVENT_ID, Date.now());

    await expect(fireAlarm(EVENT_ID)).resolves.toBeUndefined();
  });

  it('rearms no earlier than the floor, so a firing cannot spin on its own rows', async () => {
    const db = await setupDb();
    await enqueue(db);
    await armObject(EVENT_ID, Date.now());
    const before = Date.now();

    await fireAlarm(EVENT_ID);

    const alarm = await alarmOf(EVENT_ID);
    expect(alarm).not.toBeNull();
    expect(alarm as number).toBeGreaterThanOrEqual(before + REARM_FLOOR_MS);
  });

  it('rearms at the next reminder when one is further out than the floor', async () => {
    const db = await setupDb();
    const next = new Date(
      Math.floor((Date.now() + 48 * 60 * 60 * 1000) / 1000) * 1000,
    );
    await enqueue(db, { sendAt: next });
    await armObject(EVENT_ID, Date.now());

    await fireAlarm(EVENT_ID);

    expect(await alarmOf(EVENT_ID)).toBe(next.getTime());
  });

  it('goes idle when the event has nothing left pending', async () => {
    await setupDb();
    await armObject(EVENT_ID, Date.now());

    await fireAlarm(EVENT_ID);

    expect(await alarmOf(EVENT_ID)).toBeNull();
  });

  it('does nothing for an object that was never armed', async () => {
    await setupDb();

    await fireAlarm('evt_never_armed');

    expect(await alarmOf('evt_never_armed')).toBeNull();
  });
});
