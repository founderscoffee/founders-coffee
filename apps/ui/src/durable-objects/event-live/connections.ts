import type { ConnectionInfo, OutboundMessage } from './protocol.js';

export class EventConnections {
  private sockets = new Map<WebSocket, ConnectionInfo>();

  /** Registers an accepted socket as anonymous until a session is verified for it. */
  register = (ws: WebSocket): void => {
    this.sockets.set(ws, {
      userId: '',
      userName: '',
      isHost: false,
      authenticated: false,
    });
  };

  get = (ws: WebSocket): ConnectionInfo | undefined => this.sockets.get(ws);

  /** Attaches a verified identity. No-op if the socket closed while the session was being checked. */
  authenticate = (
    ws: WebSocket,
    identity: { userId: string; userName: string; isHost: boolean },
  ): boolean => {
    const existing = this.sockets.get(ws);
    if (!existing) return false;
    this.sockets.set(ws, { ...existing, ...identity, authenticated: true });
    return true;
  };

  /** Removes a socket and returns what it was, so the caller can decide whether to rebroadcast. */
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
}
