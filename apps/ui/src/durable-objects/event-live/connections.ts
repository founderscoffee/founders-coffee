import type { ConnectionInfo, OutboundMessage } from './protocol.js';
import { z } from 'zod';

const connectionAttachment = z.object({
  userId: z.string(),
  userName: z.string(),
  isHost: z.boolean(),
  authenticated: z.boolean(),
  sessionToken: z.string(),
  registeredAt: z.number(),
});

type HeartbeatClock = (ws: WebSocket) => Date | null;

export class EventConnections {
  private sockets = new Map<WebSocket, ConnectionInfo>();
  private lastHeartbeatAt: HeartbeatClock;

  constructor(lastHeartbeatAt: HeartbeatClock) {
    this.lastHeartbeatAt = lastHeartbeatAt;
  }

  register = (ws: WebSocket, now: number): void => {
    const connection = {
      userId: '',
      userName: '',
      isHost: false,
      authenticated: false,
      sessionToken: '',
      registeredAt: now,
    };
    this.sockets.set(ws, connection);
    ws.serializeAttachment(connection);
  };

  /**
   * Rebuild the map from the sockets the runtime still holds, as the object wakes.
   *
   * Only open sockets come back. One the room has closed stays `CLOSING` for as long as its client
   * never answers the close, and the runtime keeps handing it over (#84). Readmitted, it would keep
   * the alarm armed in a room nobody is in.
   */
  restore = (sockets: readonly WebSocket[]): void => {
    this.sockets.clear();
    for (const ws of sockets) {
      if (ws.readyState !== WebSocket.OPEN) continue;
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
  ): boolean => {
    const existing = this.sockets.get(ws);
    if (!existing) return false;
    const connection = { ...existing, ...identity, authenticated: true };
    this.sockets.set(ws, connection);
    ws.serializeAttachment(connection);
    return true;
  };

  /**
   * When a socket last showed it was alive: the runtime's stamp on its latest heartbeat or, until
   * it has sent one, the moment it was registered.
   *
   * The runtime answers a heartbeat without waking the object and stamps the time itself (#85), so
   * a heartbeat costs neither a wake nor a write. A socket carries no stamp until its first
   * heartbeat, and one whose client vanished first never will. Its registration is what lets a new
   * socket live until that heartbeat is due, and a silent one age out after it.
   */
  private lastSeenAt = (ws: WebSocket, connection: ConnectionInfo): number =>
    this.lastHeartbeatAt(ws)?.getTime() ?? connection.registeredAt;

  stale = (now: number, timeoutMs: number): readonly WebSocket[] =>
    [...this.sockets.entries()]
      .filter(
        ([ws, connection]) =>
          now - this.lastSeenAt(ws, connection) >= timeoutMs,
      )
      .map(([ws]) => ws);

  /** The earliest moment a socket in the room goes stale, or `null` when the room is empty. */
  nextDeadline = (timeoutMs: number): number | null => {
    const deadlines = [...this.sockets.entries()].map(
      ([ws, connection]) => this.lastSeenAt(ws, connection) + timeoutMs,
    );
    return deadlines.length === 0 ? null : Math.min(...deadlines);
  };

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

  /**
   * Send a frame to every connection whose session the room has verified.
   *
   * A socket joins the map at its upgrade, before D1 has answered for its session, and the room
   * handles other sockets' messages while it waits. Sending to the whole map sent the roster and the
   * host's table to whoever had opened a socket, including one about to be refused.
   */
  broadcast = (msg: OutboundMessage): void => {
    const data = JSON.stringify(msg);
    for (const [ws, connection] of this.sockets) {
      if (!connection.authenticated) continue;
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

  /**
   * Tell every socket in the room why it is closing, then close it.
   *
   * Every socket, not only those `broadcast` reaches: one still waiting on its session hears it too.
   * The frame says no more than the close reason after it, and a browser that is told stops
   * reconnecting to a room that has closed for good.
   */
  closeAll = (msg: OutboundMessage, code: number, reason: string): void => {
    for (const [ws] of this.entries()) {
      this.send(ws, msg);
      this.close(ws, code, reason);
    }
  };
}
