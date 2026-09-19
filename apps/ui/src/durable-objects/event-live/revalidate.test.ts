import { describe, expect, it, vi } from 'vitest';

import { EventConnections } from './connections.js';
import { revalidateConnection } from './revalidate.js';

const socket = (): WebSocket =>
  ({
    serializeAttachment: vi.fn(),
    deserializeAttachment: vi.fn(() => null),
    send: vi.fn(),
    close: vi.fn(),
  }) as unknown as WebSocket;

const dbWith = (row: Record<string, unknown> | null) => {
  const statement = {
    bind: () => statement,
    first: async <T>() => row as T | null,
  };
  return { prepare: () => statement };
};

describe('revalidateConnection', () => {
  it('closes a connected socket when its session is no longer allowed', async () => {
    const ws = socket();
    const connections = new EventConnections();
    connections.register(ws, 10);
    connections.authenticate(
      ws,
      {
        userId: 'user-1',
        userName: 'Member',
        isHost: false,
        sessionToken: 'session-1',
      },
      20,
    );

    await expect(
      revalidateConnection({
        db: dbWith(null),
        eventId: 'event-1',
        ws,
        connections,
        now: 30,
      }),
    ).resolves.toBe(false);
    expect(ws.close).toHaveBeenCalledWith(4001, 'auth_expired');
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'auth_expired', message: 'Session expired' }),
    );
  });

  it('refreshes the session and heartbeat timestamp when it remains valid', async () => {
    const ws = socket();
    const connections = new EventConnections();
    connections.register(ws, 10);
    connections.authenticate(
      ws,
      {
        userId: 'user-1',
        userName: 'Member',
        isHost: false,
        sessionToken: 'session-1',
      },
      20,
    );

    await expect(
      revalidateConnection({
        db: dbWith({
          user_id: 'user-1',
          name: 'Member',
          host_id: 'host-1',
          rsvpd: 1,
        }),
        eventId: 'event-1',
        ws,
        connections,
        now: 30,
      }),
    ).resolves.toBe(true);
    expect(connections.get(ws)).toMatchObject({ lastSeenAt: 30 });
  });
});
