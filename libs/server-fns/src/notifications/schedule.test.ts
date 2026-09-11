import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { armNotificationSchedule, armOn } from './schedule.js';

interface Armed {
  readonly name: string;
  readonly eventId: string;
  readonly sendAtMs: number;
}

const fakeNamespace = (
  behaviour: 'ok' | 'throws' = 'ok',
): { namespace: DurableObjectNamespace; armed: Armed[] } => {
  const armed: Armed[] = [];
  const namespace = {
    idFromName: (name: string) => ({ name }),
    get: (id: { name: string }) => ({
      arm: async (opts: { eventId: string; sendAtMs: number }) => {
        if (behaviour === 'throws') throw new Error('object unreachable');
        armed.push({ name: id.name, ...opts });
      },
    }),
  } as unknown as DurableObjectNamespace;
  return { namespace, armed };
};

describe('armOn', () => {
  it('addresses the object by event id and hands it the due time', async () => {
    const { namespace, armed } = fakeNamespace();
    const at = new Date('2099-01-15T18:00:00Z');

    await armOn(namespace, 'evt_abc', at);

    expect(armed).toEqual([
      { name: 'evt_abc', eventId: 'evt_abc', sendAtMs: at.getTime() },
    ]);
  });

  it('swallows an unreachable scheduler rather than failing the RSVP behind it', async () => {
    const { namespace } = fakeNamespace('throws');

    await expect(
      armOn(namespace, 'evt_abc', new Date()),
    ).resolves.toBeUndefined();
  });

  it('counts the failure, because a deployment running entirely on its sweep looks healthy', async () => {
    const written = vi.spyOn(env.ANALYTICS, 'writeDataPoint');
    const { namespace } = fakeNamespace('throws');

    await armOn(namespace, 'evt_abc', new Date());

    expect(
      written.mock.calls.map(
        ([point]) => (point as AnalyticsEngineDataPoint).blobs?.[0],
      ),
    ).toContain('notification_schedule_arm_failed');
  });

  it('counts nothing when the arm succeeds', async () => {
    const written = vi.spyOn(env.ANALYTICS, 'writeDataPoint');
    const { namespace } = fakeNamespace();

    await armOn(namespace, 'evt_abc', new Date());

    expect(written).not.toHaveBeenCalled();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('armNotificationSchedule', () => {
  it('does nothing where the binding is absent, as it is in dev and in tests', async () => {
    await expect(
      armNotificationSchedule('evt_abc', new Date()),
    ).resolves.toBeUndefined();
  });
});
