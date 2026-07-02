/**
 * EventLiveDO — one Durable Object per in-progress event. Manages real-time
 * attendee state via WebSocket hibernation (AGENTS.md §11.5).
 *
 * Activates when a client connects (no alarm needed — client-triggered).
 * Accepts WebSocket connections from RSVP'd users and the host.
 *
 * State (DO storage — ephemeral, sufficient for 30-min event window):
 * - host: { userId, arrived, tableNumber, visualCue }
 * - attendees: Map of userId to { status, etaMinutes }
 * - connections: Map of ws to { userId, authenticated }
 *
 * Auth: Better Auth session token verified against D1 on each message
 * (not just on connect — sessions can expire mid-connection).
 *
 * Message protocol (Zod-validated):
 * - Client to DO: arrived, walking_in, running_late, table_pin, auth
 * - DO to Client: roster_update, host_update, auth_ok, auth_expired, error
 */

import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/* Message schemas (Zod — AGENTS §6)                                          */
/* -------------------------------------------------------------------------- */

const authMessage = z.object({
  type: z.literal('auth'),
  sessionToken: z.string().min(1),
});

const arrivedMessage = z.object({
  type: z.literal('arrived'),
  tableNumber: z.number().int().positive().optional(),
  visualCue: z.string().max(200).optional(),
});

const walkingInMessage = z.object({
  type: z.literal('walking_in'),
});

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

/* -------------------------------------------------------------------------- */
/* Outbound message types                                                     */
/* -------------------------------------------------------------------------- */

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
    | 'auth_expired'
    | 'error'
    | 'event_cancelled';
  roster?: RosterUser[];
  host?: HostState;
  message?: string;
}

/* -------------------------------------------------------------------------- */
/* Durable Object                                                             */
/* -------------------------------------------------------------------------- */

interface ConnectionInfo {
  userId: string;
  userName: string;
  role: string;
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
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
}

interface DoEnv {
  DB: D1Db;
}

export class EventLiveDO {
  private state: DurableObjectState;
  private env: DoEnv;
  private connections = new Map<WebSocket, ConnectionInfo>();
  private attendees = new Map<string, AttendeeState>();
  private host: HostState | null = null;

  constructor(state: DurableObjectState, env: DoEnv) {
    this.state = state;
    this.env = env;

    this.state.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('message', 'pong'),
    );
  }

  /** HTTP handler — upgrades to WebSocket or returns 405. */
  fetch = async (request: Request): Promise<Response> => {
    if (request.method === 'GET') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader === 'websocket') {
        return this.handleUpgrade(request);
      }
    }
    return new Response('Method not allowed', { status: 405 });
  };

  /** WebSocket message handler (hibernation API). */
  webSocketMessage = async (
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> => {
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

  /** WebSocket close handler — remove from roster. */
  webSocketClose = async (
    ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> => {
    const conn = this.connections.get(ws);
    if (conn) {
      this.connections.delete(ws);
      if (conn.authenticated) {
        this.broadcastRoster();
      }
    }
  };

  /** WebSocket error handler. */
  webSocketError = async (ws: WebSocket, _error: unknown): Promise<void> => {
    this.connections.delete(ws);
  };

  /* ------------------------------------------------------------------------ */
  /* Internal handlers                                                         */
  /* ------------------------------------------------------------------------ */

  private handleUpgrade = (_request: Request): Response => {
    const pair = new WebSocketPair();
    const [clientWs, serverWs] = [pair[0], pair[1]];

    this.state.acceptWebSocket(serverWs);

    this.sendTo(clientWs, {
      type: 'auth_ok',
      message: 'Send auth message with your session token',
    });

    return new Response(null, { status: 101, webSocket: clientWs });
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

  private handleAuth = async (
    ws: WebSocket,
    sessionToken: string,
  ): Promise<void> => {
    const conn = this.connections.get(ws);
    if (!conn) return;

    const session = await this.verifySession(sessionToken);
    if (!session) {
      this.sendTo(ws, {
        type: 'auth_expired',
        message: 'Session expired or invalid',
      });
      ws.close(4001, 'auth_expired');
      return;
    }

    const isHost = session.role === 'host' || session.role === 'admin';

    this.connections.set(ws, {
      ...conn,
      userId: session.userId,
      userName: session.userName,
      role: session.role,
      authenticated: true,
    });

    if (isHost && !this.host) {
      this.host = {
        userId: session.userId,
        arrived: false,
      };
    }

    if (!this.attendees.has(session.userId)) {
      this.attendees.set(session.userId, {
        userId: session.userId,
        name: session.userName,
        status: 'connected',
      });
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

    const isHost = conn.role === 'host' || conn.role === 'admin';

    if (isHost && this.host) {
      this.host = {
        ...this.host,
        arrived: true,
        tableNumber: msg.tableNumber ?? this.host.tableNumber,
        visualCue: msg.visualCue ?? this.host.visualCue,
      };
      this.broadcastHost();
    } else {
      const attendee = this.attendees.get(conn.userId);
      if (attendee) {
        attendee.status = 'arrived';
        this.broadcastRoster();
      }
    }
  };

  private handleWalkingIn = async (ws: WebSocket): Promise<void> => {
    const conn = this.connections.get(ws);
    if (!conn?.authenticated) {
      this.sendTo(ws, { type: 'error', message: 'Not authenticated' });
      return;
    }

    const attendee = this.attendees.get(conn.userId);
    if (attendee) {
      attendee.status = 'walking_in';
      this.broadcastRoster();
    }
  };

  private handleRunningLate = async (
    ws: WebSocket,
    etaMinutes?: number,
  ): Promise<void> => {
    const conn = this.connections.get(ws);
    if (!conn?.authenticated) {
      this.sendTo(ws, { type: 'error', message: 'Not authenticated' });
      return;
    }

    const attendee = this.attendees.get(conn.userId);
    if (attendee) {
      attendee.status = 'running_late';
      attendee.etaMinutes = etaMinutes;
      this.broadcastRoster();
    }
  };

  private handleTablePin = async (
    ws: WebSocket,
    tableNumber: number,
  ): Promise<void> => {
    const conn = this.connections.get(ws);
    if (!conn?.authenticated) {
      this.sendTo(ws, { type: 'error', message: 'Not authenticated' });
      return;
    }

    const isHost = conn.role === 'host' || conn.role === 'admin';
    if (isHost && this.host) {
      this.host.tableNumber = tableNumber;
      this.broadcastHost();
    } else {
      this.sendTo(ws, {
        type: 'error',
        message: 'Only the host can pin tables',
      });
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Auth verification (D1 query per message)                                  */
  /* ------------------------------------------------------------------------ */

  private verifySession = async (
    sessionToken: string,
  ): Promise<{
    userId: string;
    userName: string;
    role: string;
  } | null> => {
    try {
      const sessionRow = await this.env.DB.prepare(
        `SELECT s.user_id, u.name, u.role
         FROM session s
         JOIN user u ON s.user_id = u.id
         WHERE s.token = ? AND s.expires_at > unixepoch()`,
      )
        .bind(sessionToken)
        .first<{ user_id: string; name: string; role: string }>();

      if (!sessionRow) return null;

      return {
        userId: sessionRow.user_id,
        userName: sessionRow.name,
        role: sessionRow.role,
      };
    } catch {
      return null;
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Broadcast                                                                 */
  /* ------------------------------------------------------------------------ */

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
    const roster: RosterUser[] = [];
    for (const attendee of this.attendees.values()) {
      roster.push({
        userId: attendee.userId,
        name: attendee.name,
        status: attendee.status,
        etaMinutes: attendee.etaMinutes,
      });
    }
    this.broadcast({ type: 'roster_update', roster });
  };

  private broadcastHost = (): void => {
    if (this.host) {
      this.broadcast({ type: 'host_update', host: this.host });
    }
  };

  private sendTo = (ws: WebSocket, msg: OutboundMessage): void => {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      this.connections.delete(ws);
    }
  };
}
