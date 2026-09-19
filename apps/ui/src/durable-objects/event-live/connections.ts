import type { ConnectionInfo, OutboundMessage } from './protocol.js';
import { z } from 'zod';

const connectionAttachment = z.object({
  userId: z.string(),
  userName: z.string(),
  isHost: z.boolean(),
  authenticated: z.boolean(),
  sessionToken: z.string(),
  lastSeenAt: z.number(),
});

export class EventConnections {
  private sockets = new Map<WebSocket, ConnectionInfo>();

  register = (ws: WebSocket, now: number): void => {
    const connection = {
      userId: '',
      userName: '',
      isHost: false,
      authenticated: false,
      sessionToken: '',
      lastSeenAt: now,
    };
    this.sockets.set(ws, connection);
    ws.serializeAttachment(connection);
  };

  restore = (sockets: readonly WebSocket[]): void => {
    this.sockets.clear();
    for (const ws of sockets) {
      const parsed = connectionAttachment.safeParse(ws.deserializeAttachment());
      if (parsed.success) this.sockets.set(ws, parsed.data);
    }
  };

  get = (ws: WebSocket): ConnectionInfo | undefined => this.sockets.get(ws);

  entries = (): readonly (readonly [WebSocket, ConnectionInfo])[] => [
    ...this.sockets.entries(),
  ];

  size = (): number => this.sockets.size;

  authenticate = (
    ws: WebSocket,
    identity: {
      userId: string;
      userName: string;
      isHost: boolean;
      sessionToken: string;
    },
    now: number,
  ): boolean => {
    const existing = this.sockets.get(ws);
    if (!existing) return false;
    const connection = {
      ...existing,
      ...identity,
      authenticated: true,
      lastSeenAt: now,
    };
    this.sockets.set(ws, connection);
    ws.serializeAttachment(connection);
    return true;
  };

  touch = (ws: WebSocket, now: number): boolean => {
    const existing = this.sockets.get(ws);
    if (!existing) return false;
    const connection = { ...existing, lastSeenAt: now };
    this.sockets.set(ws, connection);
    ws.serializeAttachment(connection);
    return true;
  };

  stale = (now: number, timeoutMs: number): readonly WebSocket[] =>
    [...this.sockets.entries()]
      .filter(([, connection]) => now - connection.lastSeenAt >= timeoutMs)
      .map(([ws]) => ws);

  drop = (ws: WebSocket): ConnectionInfo | undefined => {
    const existing = this.sockets.get(ws);
    this.sockets.delete(ws);
    return existing;
  };

  send = (ws: WebSocket, msg: OutboundMessage): void => {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      this.sockets.delete(ws);
    }
  };

  broadcast = (msg: OutboundMessage): void => {
    const data = JSON.stringify(msg);
    for (const [ws] of this.sockets) {
      try {
        ws.send(data);
      } catch {
        this.sockets.delete(ws);
      }
    }
  };

  close = (ws: WebSocket, code: number, reason: string): void => {
    this.sockets.delete(ws);
    try {
      ws.close(code, reason);
    } catch {
      return;
    }
  };
}
