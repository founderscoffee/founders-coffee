import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { RoomConnections } from './connections.js';

type SocketStandIn = {
  readyState: number;
  serializeAttachment: (value: unknown) => void;
  deserializeAttachment: () => unknown;
  send: (value: string) => void;
  close: (code?: number, reason?: string) => void;
};

const socket = (readyState: number = WebSocket.OPEN): WebSocket => {
  let stored: unknown = null;
  const standIn: SocketStandIn = {
    readyState,
    serializeAttachment: (value) => {
      stored = value;
    },
    deserializeAttachment: () => stored,
    send: vi.fn(),
    close: vi.fn(),
  };
  return standIn as unknown as WebSocket;
};

const member = z.object({
  userId: z.string(),
  userName: z.string(),
  sessionToken: z.string(),
});

const host = { userId: 'user-1', userName: 'Host', sessionToken: 'session-1' };

const noHeartbeatYet = (): Date | null => null;

const room = (clock: (ws: WebSocket) => Date | null = noHeartbeatYet) =>
  new RoomConnections<z.infer<typeof member>, { type: string }>(member, clock);

describe('RoomConnections', () => {
  it('keeps the verified member and the registration time on the socket', () => {
    const ws = socket();
    const connections = room();

    connections.register(ws, 10);
    expect(connections.get(ws)).toEqual({ registeredAt: 10, member: null });
    expect(connections.admit(ws, host)).toBe(true);

    expect(connections.get(ws)).toEqual({ registeredAt: 10, member: host });
    expect(connections.members()).toEqual([[ws, host]]);
  });

  it('rehydrates attachments after a Durable Object restart', () => {
    const ws = socket();
    const first = room();
    first.register(ws, 10);
    first.admit(ws, host);

    const restored = room();
    restored.restore([ws]);

    expect(restored.get(ws)).toEqual({ registeredAt: 10, member: host });
  });

  it('does not readmit a socket that is no longer open, or whose attachment it cannot read', () => {
    const open = socket();
    const closing = socket(WebSocket.CLOSING);
    const foreign = socket();
    foreign.serializeAttachment({ userId: 'user-1', authenticated: true });
    const first = room();
    first.register(open, 10);
    first.register(closing, 10);

    const restored = room();
    restored.restore([open, closing, foreign]);

    expect(restored.size()).toBe(1);
    expect(restored.get(closing)).toBeUndefined();
    expect(restored.get(foreign)).toBeUndefined();
  });

  it('sends a broadcast to verified members only', () => {
    const verified = socket();
    const joining = socket();
    const connections = room();
    connections.register(verified, 10);
    connections.register(joining, 10);
    connections.admit(verified, host);

    connections.broadcast({ type: 'roster' });

    expect(verified.send).toHaveBeenCalledWith('{"type":"roster"}');
    expect(joining.send).not.toHaveBeenCalled();
  });

  it('forgets a socket it can no longer send to', () => {
    const ws = socket();
    vi.mocked(ws.send).mockImplementation(() => {
      throw new Error('closed');
    });
    const connections = room();
    connections.register(ws, 10);
    connections.admit(ws, host);

    connections.broadcast({ type: 'roster' });

    expect(connections.size()).toBe(0);
  });
});

describe('when a socket goes stale', () => {
  it('ages a socket that has not sent a heartbeat yet from when it was registered', () => {
    const ws = socket();
    const connections = room();
    connections.register(ws, 10);

    expect(connections.stale(49, 40)).toEqual([]);
    expect(connections.stale(50, 40)).toEqual([ws]);
  });

  it('ages a socket from its latest heartbeat, which the runtime stamps', () => {
    const ws = socket();
    const connections = room(() => new Date(30));
    connections.register(ws, 10);

    expect(connections.stale(69, 40)).toEqual([]);
    expect(connections.stale(70, 40)).toEqual([ws]);
  });

  it('names the earliest deadline in the room, and none for an empty room', () => {
    const beating = socket();
    const quiet = socket();
    const connections = room((ws) => (ws === beating ? new Date(30) : null));
    expect(connections.nextDeadline(40)).toBeNull();

    connections.register(beating, 20);
    connections.register(quiet, 25);

    expect(connections.nextDeadline(40)).toBe(65);
  });
});
