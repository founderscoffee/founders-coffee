import { DurableObject } from 'cloudflare:workers';

import { EventConnections } from './event-live/connections.js';
import { clientMessage, type ClientMessage } from './event-live/protocol.js';
import { EventRoster } from './event-live/roster.js';
import {
  verifyEventSession,
  verifyEventSessionFromCookie,
  type DoEnv,
  type VerifyResult,
} from './event-live/session.js';

export class EventLiveDO extends DurableObject<DoEnv> {
  private connections = new EventConnections();
  private roster: EventRoster;
  private eventId: string | null = null;

  constructor(ctx: DurableObjectState, env: DoEnv) {
    super(ctx, env);
    this.roster = new EventRoster(ctx.storage);

    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong'),
    );
  }

  /** HTTP handler — upgrades to WebSocket (taking the eventId from the URL) or 405. */
  fetch = async (request: Request): Promise<Response> => {
    if (
      request.method === 'GET' &&
      request.headers.get('Upgrade') === 'websocket'
    ) {
      this.eventId = new URL(request.url).pathname.split('/').pop() ?? '';
      await this.roster.ensureRehydrated();
      return this.handleUpgrade(request);
    }
    return new Response('Method not allowed', { status: 405 });
  };

  webSocketMessage = async (
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> => {
    if (typeof message !== 'string') return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(message);
    } catch {
      this.connections.send(ws, { type: 'error', message: 'Invalid JSON' });
      return;
    }

    const result = clientMessage.safeParse(parsed);
    if (!result.success) {
      this.connections.send(ws, {
        type: 'error',
        message: `Invalid message: ${result.error.issues.map((i) => i.message).join(', ')}`,
      });
      return;
    }

    await this.handleMessage(ws, result.data);
  };

  webSocketClose = async (ws: WebSocket): Promise<void> => {
    const conn = this.connections.drop(ws);
    if (conn?.authenticated) this.broadcastRoster();
  };

  webSocketError = async (ws: WebSocket): Promise<void> => {
    this.connections.drop(ws);
  };

  private handleUpgrade = (request: Request): Response => {
    const pair = new WebSocketPair();
    const [clientWs, serverWs] = [pair[0], pair[1]];

    this.ctx.acceptWebSocket(serverWs);
    this.connections.register(serverWs);

    void this.authenticateConnection(serverWs, clientWs, request);

    return new Response(null, { status: 101, webSocket: clientWs });
  };

  private authenticateConnection = async (
    serverWs: WebSocket,
    clientWs: WebSocket,
    request: Request,
  ): Promise<void> => {
    const result = await verifyEventSessionFromCookie(
      this.env.DB,
      this.eventId,
      request,
    );
    await this.applyVerifiedSession(serverWs, clientWs, result);
  };

  /**
   * Shared outcome of both authentication routes (cookie on upgrade, `auth` frame). `serverWs` is
   * the connection being authenticated; `replyWs` is the socket the reply is written to.
   */
  private applyVerifiedSession = async (
    serverWs: WebSocket,
    replyWs: WebSocket,
    result: VerifyResult,
  ): Promise<void> => {
    if (!result.ok) {
      if (result.reason === 'db_error') {
        this.connections.send(replyWs, {
          type: 'error',
          message: 'Temporary auth error, please retry',
        });
        return;
      }
      this.connections.send(replyWs, {
        type: 'auth_expired',
        message:
          result.reason === 'not_allowed'
            ? 'Not invited to this event'
            : 'Session expired',
      });
      serverWs.close(4001, 'auth_expired');
      return;
    }

    const attached = this.connections.authenticate(serverWs, {
      userId: result.userId,
      userName: result.userName,
      isHost: result.isHost,
    });
    if (!attached) return;

    if (result.isHost) await this.roster.claimHost(result.userId);
    await this.roster.admitAttendee(result.userId, result.userName);

    this.connections.send(replyWs, {
      type: 'auth_ok',
      message: 'Authenticated',
    });
    this.broadcastRoster();
    if (this.roster.getHost()) this.broadcastHost();
  };

  private handleMessage = async (
    ws: WebSocket,
    msg: ClientMessage,
  ): Promise<void> => {
    switch (msg.type) {
      case 'auth':
        await this.handleAuth(ws, msg.sessionToken);
        break;
      case 'arrived':
        await this.handleArrived(ws, msg);
        break;
      case 'walking_in':
        await this.handleAttendeeStatus(ws, 'walking_in');
        break;
      case 'running_late':
        await this.handleAttendeeStatus(ws, 'running_late', msg.etaMinutes);
        break;
      case 'table_pin':
        await this.handleTablePin(ws, msg.tableNumber);
        break;
    }
  };

  private handleAuth = async (
    ws: WebSocket,
    sessionToken: string,
  ): Promise<void> => {
    if (!this.connections.get(ws) || !this.eventId) return;
    const result = await verifyEventSession(
      this.env.DB,
      this.eventId,
      sessionToken,
    );
    await this.applyVerifiedSession(ws, ws, result);
  };

  private handleArrived = async (
    ws: WebSocket,
    msg: { tableNumber?: number; visualCue?: string },
  ): Promise<void> => {
    const conn = this.connections.get(ws);
    if (!conn?.authenticated) {
      this.connections.send(ws, {
        type: 'error',
        message: 'Not authenticated',
      });
      return;
    }

    if (conn.isHost && this.roster.getHost()) {
      await this.roster.markHostArrived(msg);
      this.broadcastHost();
      return;
    }
    if (await this.roster.setAttendeeStatus(conn.userId, 'arrived')) {
      this.broadcastRoster();
    }
  };

  private handleAttendeeStatus = async (
    ws: WebSocket,
    status: 'walking_in' | 'running_late',
    etaMinutes?: number,
  ): Promise<void> => {
    const conn = this.connections.get(ws);
    if (!conn?.authenticated) return;
    if (await this.roster.setAttendeeStatus(conn.userId, status, etaMinutes)) {
      this.broadcastRoster();
    }
  };

  private handleTablePin = async (
    ws: WebSocket,
    tableNumber: number,
  ): Promise<void> => {
    const conn = this.connections.get(ws);
    if (!conn?.authenticated) return;
    if (conn.isHost && this.roster.getHost()) {
      await this.roster.pinTable(tableNumber);
      this.broadcastHost();
      return;
    }
    this.connections.send(ws, {
      type: 'error',
      message: 'Only the host can pin tables',
    });
  };

  private broadcastRoster = (): void => {
    this.connections.broadcast({
      type: 'roster_update',
      roster: this.roster.toRoster(),
    });
  };

  private broadcastHost = (): void => {
    const host = this.roster.getHost();
    if (host) this.connections.broadcast({ type: 'host_update', host });
  };
}
