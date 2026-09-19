import { describe, expect, it, vi } from 'vitest';

import type { ConnectionInfo } from './protocol.js';
import { EventConnections } from './connections.js';

type SocketMock = {
  serializeAttachment: (value: unknown) => void;
  deserializeAttachment: () => unknown;
  send: (value: string) => void;
  close: (code?: number, reason?: string) => void;
};

const socket = (attachment: unknown = null): WebSocket => {
  let stored = attachment;
  const mock: SocketMock = {
    serializeAttachment: (value) => {
      stored = value;
    },
    deserializeAttachment: () => stored,
    send: vi.fn(),
    close: vi.fn(),
  };
  return mock as unknown as WebSocket;
};

const identity = {
  userId: 'user-1',
  userName: 'Host',
  isHost: true,
  sessionToken: 'session-1',
};

describe('EventConnections', () => {
  it('persists authenticated identity and last-seen time on the socket', () => {
    const ws = socket();
    const connections = new EventConnections();

    connections.register(ws, 10);
    expect(connections.authenticate(ws, identity, 20)).toBe(true);
    connections.touch(ws, 30);

    expect(connections.get(ws)).toMatchObject({
      ...identity,
      authenticated: true,
      lastSeenAt: 30,
    });
    expect(connections.stale(69, 40)).toEqual([]);
    expect(connections.stale(70, 40)).toEqual([ws]);
  });

  it('rehydrates attachments after a Durable Object restart', () => {
    const ws = socket();
    const first = new EventConnections();
    first.register(ws, 10);
    first.authenticate(ws, identity, 20);

    const restored = new EventConnections();
    restored.restore([ws]);

    expect(restored.get(ws)).toMatchObject<Partial<ConnectionInfo>>({
      ...identity,
      authenticated: true,
      lastSeenAt: 20,
    });
  });
});
