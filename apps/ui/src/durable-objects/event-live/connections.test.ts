import { describe, expect, it, vi } from 'vitest';

import type { ConnectionInfo } from './protocol.js';
import { EventConnections } from './connections.js';

type SocketMock = {
  readyState: number;
  serializeAttachment: (value: unknown) => void;
  deserializeAttachment: () => unknown;
  send: (value: string) => void;
  close: (code?: number, reason?: string) => void;
};

const socket = (readyState: number = WebSocket.OPEN): WebSocket => {
  let stored: unknown = null;
  const mock: SocketMock = {
    readyState,
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

const noHeartbeatYet = (): Date | null => null;

describe('EventConnections', () => {
  it('persists the authenticated identity and the registration time on the socket', () => {
    const ws = socket();
    const connections = new EventConnections(noHeartbeatYet);

    connections.register(ws, 10);
    expect(connections.authenticate(ws, identity)).toBe(true);

    expect(connections.get(ws)).toMatchObject({
      ...identity,
      authenticated: true,
      registeredAt: 10,
    });
  });

  it('rehydrates attachments after a Durable Object restart', () => {
    const ws = socket();
    const first = new EventConnections(noHeartbeatYet);
    first.register(ws, 10);
    first.authenticate(ws, identity);

    const restored = new EventConnections(noHeartbeatYet);
    restored.restore([ws]);

    expect(restored.get(ws)).toMatchObject<Partial<ConnectionInfo>>({
      ...identity,
      authenticated: true,
      registeredAt: 10,
    });
  });

  it('does not readmit a socket that is no longer open', () => {
    const open = socket();
    const closing = socket(WebSocket.CLOSING);
    const first = new EventConnections(noHeartbeatYet);
    first.register(open, 10);
    first.register(closing, 10);

    const restored = new EventConnections(noHeartbeatYet);
    restored.restore([open, closing]);

    expect(restored.size()).toBe(1);
    expect(restored.get(closing)).toBeUndefined();
  });
});

describe('when a socket goes stale', () => {
  it('ages a socket that has not sent a heartbeat yet from when it was registered', () => {
    const ws = socket();
    const connections = new EventConnections(noHeartbeatYet);
    connections.register(ws, 10);

    expect(connections.stale(49, 40)).toEqual([]);
    expect(connections.stale(50, 40)).toEqual([ws]);
  });

  it('ages a socket from its latest heartbeat, which the runtime stamps', () => {
    const ws = socket();
    const connections = new EventConnections(() => new Date(30));
    connections.register(ws, 10);

    expect(connections.stale(69, 40)).toEqual([]);
    expect(connections.stale(70, 40)).toEqual([ws]);
  });

  it('names the earliest deadline in the room, and none for an empty room', () => {
    const beating = socket();
    const quiet = socket();
    const connections = new EventConnections((ws) =>
      ws === beating ? new Date(30) : null,
    );
    expect(connections.nextDeadline(40)).toBeNull();

    connections.register(beating, 20);
    connections.register(quiet, 25);

    expect(connections.nextDeadline(40)).toBe(65);
  });
});
