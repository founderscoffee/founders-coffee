/**
 * EventLiveDO — one Durable Object per in-progress event. Real-time attendee state via WebSocket
 * hibernation (AGENTS.md §11.5).
 *
 * Security: the DO extracts its `eventId` from the upgrade URL and verifies, per connection, that
 * the user is EITHER the event's actual host (`events.host_id`) OR has a `going` RSVP — not merely
 * "has a host/admin role" (H1/H2). Sessions are checked against D1 on each auth.
 *
 * Persistence: `host` + `attendees` are stored in `ctx.storage` so the roster survives hibernation
 * eviction; `connections` is ephemeral (WebSockets aren't serializable — clients reconnect).
 *
 * Message protocol (Zod-validated): client→DO { auth, arrived, walking_in, running_late, table_pin };
 * DO→client { roster_update, host_update, auth_required, auth_expired, error }.
 */

import { DurableObject } from 'cloudflare:workers';
import { z } from 'zod';

const authMessage = z.object({
  type: z.literal('auth'),
  sessionToken: z.string().min(1),
});

const arrivedMessage = z.object({
  type: z.literal('arrived'),
  tableNumber: z.number().int().positive().optional(),
  visualCue: z.string().max(200).optional(),
});

const walkingInMessage = z.object({ type: z.literal('walking_in') });

const runningLateMessage = z.object({
  type: z.literal('running_late'),
  etaMinutes: z.number().int().positive().max(120).optional(),
});

const tablePinMessage = z.object({
  type: z.literal('table_pin'),
  tableNumber: z.number().int().positive(),
});

const clientMessage = z.discriminatedUnion('type', [
  authMessage,
  arrivedMessage,
  walkingInMessage,
  runningLateMessage,
  tablePinMessage,
]);

type ClientMessage = z.infer<typeof clientMessage>;

interface RosterUser {
  userId: string;
  name: string;
  status: 'arrived' | 'walking_in' | 'running_late' | 'connected';
  etaMinutes?: number;
}

interface HostState {
  userId: string;
  arrived: boolean;
  tableNumber?: number;
  visualCue?: string;
}

interface OutboundMessage {
  type:
    | 'roster_update'
    | 'host_update'
    | 'auth_ok'
    | 'auth_required'
    | 'auth_expired'
    | 'error'
    | 'event_cancelled';
  roster?: RosterUser[];
  host?: HostState;
  message?: string;
}

interface ConnectionInfo {
  userId: string;
  userName: string;
  isHost: boolean;
  authenticated: boolean;
}

interface AttendeeState {
  userId: string;
  name: string;
  status: 'arrived' | 'walking_in' | 'running_late' | 'connected';
  etaMinutes?: number;
}

interface D1Db {
  prepare: (query: string) => D1PreparedStatement;
}

interface D1PreparedStatement {
  bind: (...args: unknown[]) => D1PreparedStatement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
}

interface DoEnv {
  DB: D1Db;
}

type VerifyResult =
  | { ok: true; userId: string; userName: string; isHost: boolean }
  | { ok: false; reason: 'no_session' | 'not_allowed' | 'db_error' };

const STORAGE_HOST = 'host';
const STORAGE_ATTENDEES = 'attendees';

export class EventLiveDO extends DurableObject<DoEnv> {
  private connections = new Map<WebSocket, ConnectionInfo>();
  private attendees = new Map<string, AttendeeState>();
  private host: HostState | null = null;
  private eventId: string | null = null;
  private rehydrated = false;

  constructor(ctx: DurableObjectState, env: DoEnv) {
    super(ctx, env);

    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  /** HTTP handler — upgrades to WebSocket (extracting the eventId from the URL) or 405. */
  fetch = async (request: Request): Promise<Response> => {
    if (request.method === 'GET' && request.headers.get('Upgrade') === 'websocket') {
      const eventId = new URL(request.url).pathname.split('/').pop() ?? '';
      this.eventId = eventId;
      await this.ensureRehydrated();
      return this.handleUpgrade(request);
    }
    return new Response('Method not allowed', { status: 405 });
  };

  webSocketMessage = async (ws: WebSocket, message: string | ArrayBuffer): Promise<void> => {
    if (typeof message !== 'string') return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(message);
    } catch {
      this.sendTo(ws, { type: 'error', message: 'Invalid JSON' });
      return;
    }

    const result = clientMessage.safeParse(parsed);
    if (!result.success) {
      this.sendTo(ws, {
        type: 'error',
        message: `Invalid message: ${result.error.issues.map((i) => i.message).join(', ')}`,
      });
      return;
    }

    await this.handleMessage(ws, result.data);
  };

  webSocketClose = async (ws: WebSocket): Promise<void> => {
    const conn = this.connections.get(ws);
    if (conn) {
      this.connections.delete(ws);
      if (conn.authenticated) this.broadcastRoster();
    }
  };

  webSocketError = async (ws: WebSocket): Promise<void> => {
    this.connections.delete(ws);
  };

  /* -------------------------------------------------------------------------- */

  private handleUpgrade = (request: Request): Response => {
    const pair = new WebSocketPair();
    const [clientWs, serverWs] = [pair[0], pair[1]];

    this.ctx.acceptWebSocket(serverWs);
    this.connections.set(serverWs, {
      userId: '',
      userName: '',
      isHost: false,
      authenticated: false,
    });

    /* Cookie-based auth — the 101 returns immediately; auth_ok/expired is sent once the session is
       verified from the browser's automatically-sent Cookie header (L4: the client can't read the
       httpOnly session cookie to send it as a message, so the DO reads it on upgrade). */
    void this.authenticateConnection(serverWs, clientWs, request);

    return new Response(null, { status: 101, webSocket: clientWs });
  };

  private verifyFromCookie = async (request: Request): Promise<VerifyResult> => {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return { ok: false, reason: 'no_session' };

    for (const part of cookieHeader.split(';')) {
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      const value = part.slice(eq + 1).trim();
      if (!value) continue;
      const result = await this.verifySession(value);
      if (result.ok || (!result.ok && result.reason === 'not_allowed')) return result;
    }
    return { ok: false, reason: 'no_session' };
  };

  private authenticateConnection = async (
    serverWs: WebSocket,
    clientWs: WebSocket,
    request: Request,
  ): Promise<void> => {
    const result = await this.verifyFromCookie(request);

    if (!result.ok) {
      if (result.reason === 'db_error') {
        this.sendTo(clientWs, { type: 'error', message: 'Temporary auth error, please retry' });
        return;
      }
      this.sendTo(clientWs, {
        type: 'auth_expired',
        message: result.reason === 'not_allowed' ? 'Not invited to this event' : 'Session expired',
      });
      serverWs.close(4001, 'auth_expired');
      return;
    }

    const conn = this.connections.get(serverWs);
    if (!conn) return;

    this.connections.set(serverWs, {
      ...conn,
      userId: result.userId,
      userName: result.userName,
      isHost: result.isHost,
      authenticated: true,
    });

    if (result.isHost && !this.host) {
      this.host = { userId: result.userId, arrived: false };
      await this.persistState();
    }

    if (!this.attendees.has(result.userId)) {
      this.attendees.set(result.userId, {
        userId: result.userId,
        name: result.userName,
        status: 'connected',
      });
      await this.persistState();
    }

    this.sendTo(clientWs, { type: 'auth_ok', message: 'Authenticated' });
    this.broadcastRoster();
    if (this.host) this.broadcastHost();
  };

  private handleMessage = async (ws: WebSocket, msg: ClientMessage): Promise<void> => {
    switch (msg.type) {
      case 'auth':
        await this.handleAuth(ws, msg.sessionToken);
        break;
      case 'arrived':
        await this.handleArrived(ws, msg);
        break;
      case 'walking_in':
        await this.handleWalkingIn(ws);
        break;
      case 'running_late':
        await this.handleRunningLate(ws, msg.etaMinutes);
        break;
      case 'table_pin':
        await this.handleTablePin(ws, msg.tableNumber);
        break;
    }
  };

  private handleAuth = async (ws: WebSocket, sessionToken: string): Promise<void> => {
    const conn = this.connections.get(ws);
    if (!conn || !this.eventId) return;

    const result = await this.verifySession(sessionToken);
    if (!result.ok) {
      if (result.reason === 'db_error') {
        /* Transient D1 error — do NOT close; tell the client to retry shortly. */
        this.sendTo(ws, { type: 'error', message: 'Temporary auth error, please retry' });
        return;
      }
      this.sendTo(ws, {
        type: 'auth_expired',
        message: result.reason === 'not_allowed' ? 'Not invited to this event' : 'Session expired',
      });
      ws.close(4001, 'auth_expired');
      return;
    }

    this.connections.set(ws, {
      ...conn,
      userId: result.userId,
      userName: result.userName,
      isHost: result.isHost,
      authenticated: true,
    });

    if (result.isHost && !this.host) {
      this.host = { userId: result.userId, arrived: false };
      await this.persistState();
    }

    if (!this.attendees.has(result.userId)) {
      this.attendees.set(result.userId, {
        userId: result.userId,
        name: result.userName,
        status: 'connected',
      });
      await this.persistState();
    }

    this.sendTo(ws, { type: 'auth_ok', message: 'Authenticated' });
    this.broadcastRoster();
    if (this.host) this.broadcastHost();
  };

  private handleArrived = async (
    ws: WebSocket,
    msg: { tableNumber?: number; visualCue?: string },
  ): Promise<void> => {
    const conn = this.connections.get(ws);
    if (!conn?.authenticated) {
      this.sendTo(ws, { type: 'error', message: 'Not authenticated' });
      return;
    }

    if (conn.isHost && this.host) {
      this.host = {
        ...this.host,
        arrived: true,
        tableNumber: msg.tableNumber ?? this.host.tableNumber,
        visualCue: msg.visualCue ?? this.host.visualCue,
      };
      await this.persistState();
      this.broadcastHost();
    } else {
      const attendee = this.attendees.get(conn.userId);
      if (attendee) {
        attendee.status = 'arrived';
        await this.persistState();
        this.broadcastRoster();
      }
    }
  };

  private handleWalkingIn = async (ws: WebSocket): Promise<void> => {
    const conn = this.connections.get(ws);
    if (!conn?.authenticated) return;
    const attendee = this.attendees.get(conn.userId);
    if (attendee) {
      attendee.status = 'walking_in';
      await this.persistState();
      this.broadcastRoster();
    }
  };

  private handleRunningLate = async (ws: WebSocket, etaMinutes?: number): Promise<void> => {
    const conn = this.connections.get(ws);
    if (!conn?.authenticated) return;
    const attendee = this.attendees.get(conn.userId);
    if (attendee) {
      attendee.status = 'running_late';
      attendee.etaMinutes = etaMinutes;
      await this.persistState();
      this.broadcastRoster();
    }
  };

  private handleTablePin = async (ws: WebSocket, tableNumber: number): Promise<void> => {
    const conn = this.connections.get(ws);
    if (!conn?.authenticated) return;
    /* Only THIS event's host (verified in handleAuth) may pin — not any host/admin role (H1). */
    if (conn.isHost && this.host) {
      this.host.tableNumber = tableNumber;
      await this.persistState();
      this.broadcastHost();
    } else {
      this.sendTo(ws, { type: 'error', message: 'Only the host can pin tables' });
    }
  };

  /* -------------------------------------------------------------------------- */
  /* Auth — verifies session AND event membership (host-of-this-event OR RSVP'd) */

  private verifySession = async (sessionToken: string): Promise<VerifyResult> => {
    let row: {
      user_id: string;
      name: string;
      host_id: string;
      rsvpd: number;
    } | null;

    try {
      row = await this.env.DB.prepare(
        `SELECT s.user_id AS user_id, u.name AS name, e.host_id AS host_id,
                EXISTS(SELECT 1 FROM event_rsvps WHERE event_id = e.id AND user_id = s.user_id AND status = 'going') AS rsvpd
         FROM session s
         JOIN user u ON s.user_id = u.id
         JOIN events e ON e.id = ?
         WHERE s.token = ? AND s.expires_at > unixepoch()`,
      )
        .bind(this.eventId, sessionToken)
        .first();
    } catch {
      return { ok: false, reason: 'db_error' };
    }

    if (!row) return { ok: false, reason: 'no_session' };

    const isHost = row.user_id === row.host_id;
    if (!isHost && row.rsvpd !== 1) return { ok: false, reason: 'not_allowed' };

    return { ok: true, userId: row.user_id, userName: row.name, isHost };
  };

  /* -------------------------------------------------------------------------- */
  /* Persistence — host + attendees survive hibernation eviction (H8a) */

  private ensureRehydrated = async (): Promise<void> => {
    if (this.rehydrated) return;
    this.rehydrated = true;
    const [host, attendees] = await Promise.all([
      this.ctx.storage.get<HostState>(STORAGE_HOST),
      this.ctx.storage.get<[string, AttendeeState][]>(STORAGE_ATTENDEES),
    ]);
    this.host = host ?? null;
    this.attendees = new Map(attendees ?? []);
  };

  private persistState = async (): Promise<void> => {
    await Promise.all([
      this.ctx.storage.put(STORAGE_HOST, this.host),
      this.ctx.storage.put(STORAGE_ATTENDEES, [...this.attendees.entries()]),
    ]);
  };

  /* -------------------------------------------------------------------------- */
  /* Broadcast */

  private broadcast = (msg: OutboundMessage): void => {
    const data = JSON.stringify(msg);
    for (const [ws] of this.connections) {
      try {
        ws.send(data);
      } catch {
        this.connections.delete(ws);
      }
    }
  };

  private broadcastRoster = (): void => {
    const roster: RosterUser[] = [...this.attendees.values()].map((a) => ({
      userId: a.userId,
      name: a.name,
      status: a.status,
      etaMinutes: a.etaMinutes,
    }));
    this.broadcast({ type: 'roster_update', roster });
  };

  private broadcastHost = (): void => {
    if (this.host) this.broadcast({ type: 'host_update', host: this.host });
  };

  private sendTo = (ws: WebSocket, msg: OutboundMessage): void => {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      this.connections.delete(ws);
    }
  };
}
