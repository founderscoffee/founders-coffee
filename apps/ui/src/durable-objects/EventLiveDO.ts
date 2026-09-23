import { DurableObject } from 'cloudflare:workers';

import { handleLiveAction } from './event-live/actions.js';
import { EventConnections } from './event-live/connections.js';
import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
} from './event-live/constants.js';
import { clientMessage, type ClientMessage } from './event-live/protocol.js';
import {
  refuseConnection,
  revalidateConnection,
} from './event-live/revalidate.js';
import { EventRoster } from './event-live/roster.js';
import {
  verifyEventSession,
  verifyEventSessionFromCookie,
  type DoEnv,
  type VerifyResult,
} from './event-live/session.js';

const EVENT_ID_KEY = 'eventId';
const INTERNAL_CANCEL_HEADER = 'x-event-live-internal';

type VerifiedSession = Extract<VerifyResult, { ok: true }>;

export class EventLiveDO extends DurableObject<DoEnv> {
  private connections = new EventConnections();
  private roster: EventRoster;

  constructor(ctx: DurableObjectState, env: DoEnv) {
    super(ctx, env);
    this.roster = new EventRoster(ctx.storage);
    this.connections.restore(ctx.getWebSockets());

    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong'),
    );
  }

  /** HTTP handler — upgrades to WebSocket (taking the eventId from the URL) or 405. */
  fetch = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const eventId = url.pathname.split('/').pop() ?? '';
    if (
      request.method === 'POST' &&
      request.headers.get(INTERNAL_CANCEL_HEADER) === '1' &&
      eventId
    ) {
      await this.setEventId(eventId);
      await this.roster.ensureRehydrated();
      this.connections.restore(this.ctx.getWebSockets());
      this.connections.broadcast({ type: 'event_cancelled' });
      for (const [ws] of this.connections.entries())
        this.connections.close(ws, 4003, 'event_cancelled');
      await this.ctx.storage.deleteAlarm();
      return new Response(null, { status: 204 });
    }
    if (
      request.method === 'GET' &&
      request.headers.get('Upgrade') === 'websocket' &&
      eventId
    ) {
      await this.setEventId(eventId);
      await this.roster.ensureRehydrated();
      return this.handleUpgrade(request);
    }
    return new Response('Method not allowed', { status: 405 });
  };

  webSocketMessage = async (
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> => {
    await this.roster.ensureRehydrated();
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

    const eventId = await this.eventId();
    if (!eventId) return;
    if (result.data.type === 'auth') {
      await this.handleMessage(ws, result.data);
      return;
    }
    const valid = await revalidateConnection({
      db: this.env.DB,
      eventId,
      ws,
      connections: this.connections,
      now: Date.now(),
    });
    if (!valid) return;
    this.connections.touch(ws, Date.now());
    if (result.data.type === 'heartbeat') {
      this.connections.send(ws, { type: 'heartbeat_ack' });
      return;
    }
    await this.handleMessage(ws, result.data);
  };

  webSocketClose = async (ws: WebSocket): Promise<void> => {
    const conn = this.connections.drop(ws);
    if (conn?.authenticated) this.broadcastRoster();
    await this.armHeartbeat();
  };

  webSocketError = async (ws: WebSocket): Promise<void> => {
    this.connections.drop(ws);
    await this.armHeartbeat();
  };

  private handleUpgrade = async (request: Request): Promise<Response> => {
    const pair = new WebSocketPair();
    const [clientWs, serverWs] = [pair[0], pair[1]];

    this.ctx.acceptWebSocket(serverWs);
    this.connections.register(serverWs, Date.now());

    await this.authenticateConnection(serverWs, request);

    return new Response(null, { status: 101, webSocket: clientWs });
  };

  private authenticateConnection = async (
    serverWs: WebSocket,
    request: Request,
  ): Promise<void> => {
    const eventId = await this.eventId();
    const result = await verifyEventSessionFromCookie(
      this.env.DB,
      eventId,
      request,
    );
    await this.applyVerifiedSession(serverWs, result);
  };

  /**
   * Shared outcome of both authentication routes (cookie on upgrade, `auth` frame).
   *
   * The alarm is armed once the outcome is known. A refused socket has left the room by then
   * (#84), so a room that turned away its only visitor keeps no alarm.
   */
  private applyVerifiedSession = async (
    serverWs: WebSocket,
    result: VerifyResult,
  ): Promise<void> => {
    if (result.ok) await this.admit(serverWs, result);
    else refuseConnection(this.connections, serverWs, result.reason);
    await this.armHeartbeat();
  };

  private admit = async (
    serverWs: WebSocket,
    session: VerifiedSession,
  ): Promise<void> => {
    const attached = this.connections.authenticate(
      serverWs,
      {
        userId: session.userId,
        userName: session.userName,
        isHost: session.isHost,
        sessionToken: session.sessionToken,
      },
      Date.now(),
    );
    if (!attached) return;

    if (session.isHost) await this.roster.claimHost(session.userId);
    await this.roster.admitAttendee(session.userId, session.userName);

    this.connections.send(serverWs, {
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
    if (msg.type === 'auth') {
      await this.handleAuth(ws, msg.sessionToken);
      return;
    }
    if (msg.type === 'heartbeat') return;
    await handleLiveAction({
      ws,
      message: msg,
      connections: this.connections,
      roster: this.roster,
    });
  };

  private handleAuth = async (
    ws: WebSocket,
    sessionToken: string,
  ): Promise<void> => {
    const eventId = await this.eventId();
    if (!this.connections.get(ws) || !eventId) return;
    const result = await verifyEventSession(this.env.DB, eventId, sessionToken);
    await this.applyVerifiedSession(ws, result);
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

  // eslint-disable-next-line no-restricted-syntax -- Cloudflare RPC requires a prototype method.
  override async alarm(): Promise<void> {
    await this.roster.ensureRehydrated();
    this.connections.restore(this.ctx.getWebSockets());
    const stale = this.connections.stale(Date.now(), HEARTBEAT_TIMEOUT_MS);
    let rosterChanged = false;
    for (const ws of stale) {
      const connection = this.connections.drop(ws);
      if (connection?.authenticated) rosterChanged = true;
      try {
        ws.close(4002, 'heartbeat_timeout');
      } catch {
        continue;
      }
    }
    if (rosterChanged) this.broadcastRoster();
    await this.armHeartbeat();
  }

  private setEventId = async (eventId: string): Promise<void> => {
    await this.ctx.storage.put(EVENT_ID_KEY, eventId);
  };

  private eventId = async (): Promise<string | null> =>
    (await this.ctx.storage.get<string>(EVENT_ID_KEY)) ?? null;

  private armHeartbeat = async (): Promise<void> => {
    if (this.connections.size() === 0) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    const next = Date.now() + HEARTBEAT_INTERVAL_MS;
    const current = await this.ctx.storage.getAlarm();
    if (current === null || current > next)
      await this.ctx.storage.setAlarm(next);
  };
}
