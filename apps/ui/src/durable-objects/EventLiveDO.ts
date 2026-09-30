import { DurableObject } from 'cloudflare:workers';

import {
  answerHeartbeats,
  armHeartbeat,
  reapStale,
  recheckMember,
  recheckMembers,
  refuse,
  RoomConnections,
  verifySession,
  verifySessionFromCookie,
  type SessionVerdict,
} from '@founders-coffee/server-fns/rooms';

import { handleLiveAction } from './event-live/actions.js';
import { liveRoomEventId } from './event-live/path.js';
import { clientMessage, type OutboundMessage } from './event-live/protocol.js';
import { EventRoster } from './event-live/roster.js';
import {
  LIVE_REFUSALS,
  liveMember,
  liveMembership,
  type DoEnv,
  type LiveMember,
} from './event-live/session.js';

const EVENT_ID_KEY = 'eventId';

export class EventLiveDO extends DurableObject<DoEnv> {
  private connections: RoomConnections<LiveMember, OutboundMessage>;
  private roster: EventRoster;

  /**
   * Take back the sockets the runtime still holds, and have the runtime answer heartbeats itself.
   */
  constructor(ctx: DurableObjectState, env: DoEnv) {
    super(ctx, env);
    this.roster = new EventRoster(ctx.storage);
    this.connections = new RoomConnections(liveMember, (ws) =>
      ctx.getWebSocketAutoResponseTimestamp(ws),
    );
    this.connections.restore(ctx.getWebSockets());
    answerHeartbeats(ctx);
  }

  /**
   * Take a browser's WebSocket upgrade for `/api/live/<eventId>`, or answer 405.
   *
   * An upgrade is all a request can ask of the room. Its public route forwards what clients send, so
   * cancelling is `cancel`, which only code holding the `EVENT_LIVE` binding can call. It used to be
   * a branch here, opened by a POST carrying `x-event-live-internal: 1`.
   */
  fetch = async (request: Request): Promise<Response> => {
    const eventId = liveRoomEventId(new URL(request.url).pathname);
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

  /**
   * Close the room of a cancelled meetup: every socket is told, then closed with 4003, and the
   * heartbeat alarm goes, since nobody is left for it to check.
   */
  // eslint-disable-next-line no-restricted-syntax -- Cloudflare RPC requires a prototype method.
  async cancel(): Promise<void> {
    this.connections.restore(this.ctx.getWebSockets());
    this.connections.closeAll(LIVE_REFUSALS.closed);
    await this.ctx.storage.deleteAlarm();
  }

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
      await this.handleAuth(ws, result.data.sessionToken);
      return;
    }
    const valid = await recheckMember({
      connections: this.connections,
      ws,
      lookup: liveMembership(this.env.DB, eventId),
      refusals: LIVE_REFUSALS,
    });
    if (!valid) return;
    await handleLiveAction({
      ws,
      message: result.data,
      connections: this.connections,
      roster: this.roster,
    });
  };

  webSocketClose = async (ws: WebSocket): Promise<void> => {
    const conn = this.connections.drop(ws);
    if (conn?.member) this.broadcastRoster();
    await armHeartbeat(this.ctx.storage, this.connections);
  };

  webSocketError = async (ws: WebSocket): Promise<void> => {
    this.connections.drop(ws);
    await armHeartbeat(this.ctx.storage, this.connections);
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
    const result = await verifySessionFromCookie(
      liveMembership(this.env.DB, eventId),
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
    result: SessionVerdict<LiveMember>,
  ): Promise<void> => {
    if (result.ok) await this.admit(serverWs, result.member);
    else refuse(this.connections, serverWs, result.reason, LIVE_REFUSALS);
    await armHeartbeat(this.ctx.storage, this.connections);
  };

  private admit = async (
    serverWs: WebSocket,
    member: LiveMember,
  ): Promise<void> => {
    const attached = this.connections.admit(serverWs, member);
    if (!attached) return;

    if (member.isHost) await this.roster.claimHost(member.userId);
    await this.roster.admitAttendee(member.userId, member.userName);

    this.connections.send(serverWs, {
      type: 'auth_ok',
      message: 'Authenticated',
    });
    this.broadcastRoster();
    if (this.roster.getHost()) this.broadcastHost();
  };

  private handleAuth = async (
    ws: WebSocket,
    sessionToken: string,
  ): Promise<void> => {
    const eventId = await this.eventId();
    if (!this.connections.get(ws) || !eventId) return;
    const result = await verifySession(
      liveMembership(this.env.DB, eventId),
      sessionToken,
    );
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

  /**
   * Reap the sockets that stopped sending heartbeats, check the sessions of those left, and arm the
   * next deadline.
   *
   * This is where a quiet connection's session is checked. Heartbeats are answered by the runtime
   * and never reach the room (#85), so the check moved here from every message: one query for the
   * whole room per alarm, not one per socket per heartbeat (#87).
   */
  // eslint-disable-next-line no-restricted-syntax -- Cloudflare RPC requires a prototype method.
  override async alarm(): Promise<void> {
    await this.roster.ensureRehydrated();
    this.connections.restore(this.ctx.getWebSockets());
    const reaped = reapStale(this.connections, Date.now());
    const eventId = await this.eventId();
    if (eventId)
      await recheckMembers({
        connections: this.connections,
        lookup: liveMembership(this.env.DB, eventId),
        refusals: LIVE_REFUSALS,
      });
    if (reaped.some((connection) => connection.member)) this.broadcastRoster();
    await armHeartbeat(this.ctx.storage, this.connections);
  }

  private setEventId = async (eventId: string): Promise<void> => {
    await this.ctx.storage.put(EVENT_ID_KEY, eventId);
  };

  private eventId = async (): Promise<string | null> =>
    (await this.ctx.storage.get<string>(EVENT_ID_KEY)) ?? null;
}
