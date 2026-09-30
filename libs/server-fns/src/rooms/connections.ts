import { z } from 'zod';

type HeartbeatClock = (ws: WebSocket) => Date | null;

export type RoomMember = {
  readonly userId: string;
  readonly sessionToken: string;
};

export type RoomConnection<Member extends RoomMember> = {
  readonly registeredAt: number;
  readonly member: Member | null;
};

export class RoomConnections<Member extends RoomMember, Frame> {
  private sockets = new Map<WebSocket, RoomConnection<Member>>();
  private attachment: z.ZodType<RoomConnection<Member>>;
  private lastHeartbeatAt: HeartbeatClock;

  constructor(member: z.ZodType<Member>, lastHeartbeatAt: HeartbeatClock) {
    this.attachment = z.object({
      registeredAt: z.number(),
      member: member.nullable(),
    });
    this.lastHeartbeatAt = lastHeartbeatAt;
  }

  register = (ws: WebSocket, now: number): void => {
    this.remember(ws, { registeredAt: now, member: null });
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
      const parsed = this.attachment.safeParse(ws.deserializeAttachment());
      if (parsed.success) this.sockets.set(ws, parsed.data);
    }
  };

  get = (ws: WebSocket): RoomConnection<Member> | undefined =>
    this.sockets.get(ws);

  entries = (): readonly (readonly [WebSocket, RoomConnection<Member>])[] => [
    ...this.sockets.entries(),
  ];

  /** The sockets whose session the room has verified, each with the member it belongs to. */
  members = (): readonly (readonly [WebSocket, Member])[] =>
    this.entries().flatMap(([ws, connection]) =>
      connection.member ? [[ws, connection.member] as const] : [],
    );

  size = (): number => this.sockets.size;

  /** Record who a socket belongs to once the room has verified its session, on the socket too. */
  admit = (ws: WebSocket, member: Member): boolean => {
    const existing = this.sockets.get(ws);
    if (!existing) return false;
    this.remember(ws, { ...existing, member });
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
  private lastSeenAt = (
    ws: WebSocket,
    connection: RoomConnection<Member>,
  ): number => this.lastHeartbeatAt(ws)?.getTime() ?? connection.registeredAt;

  stale = (now: number, timeoutMs: number): readonly WebSocket[] =>
    this.entries()
      .filter(
        ([ws, connection]) =>
          now - this.lastSeenAt(ws, connection) >= timeoutMs,
      )
      .map(([ws]) => ws);

  /** The earliest moment a socket in the room goes stale, or `null` when the room is empty. */
  nextDeadline = (timeoutMs: number): number | null => {
    const deadlines = this.entries().map(
      ([ws, connection]) => this.lastSeenAt(ws, connection) + timeoutMs,
    );
    return deadlines.length === 0 ? null : Math.min(...deadlines);
  };

  drop = (ws: WebSocket): RoomConnection<Member> | undefined => {
    const existing = this.sockets.get(ws);
    this.sockets.delete(ws);
    return existing;
  };

  send = (ws: WebSocket, frame: Frame): void => {
    this.sendText(ws, JSON.stringify(frame));
  };

  /**
   * Send a frame to every connection whose session the room has verified.
   *
   * A socket joins the map at its upgrade, before D1 has answered for its session, and the room
   * handles other sockets' messages while it waits. Sending to the whole map sent the live roster
   * and the host's table to whoever had opened a socket, including one about to be refused.
   */
  broadcast = (frame: Frame): void => {
    const data = JSON.stringify(frame);
    for (const [ws] of this.members()) this.sendText(ws, data);
  };

  /** Send each verified connection the frame made for its own member, as {@link broadcast} does. */
  broadcastEach = (frameFor: (member: Member) => Frame): void => {
    for (const [ws, member] of this.members()) this.send(ws, frameFor(member));
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
  closeAll = (frame: Frame, code: number, reason: string): void => {
    for (const [ws] of this.entries()) {
      this.send(ws, frame);
      this.close(ws, code, reason);
    }
  };

  private remember = (
    ws: WebSocket,
    connection: RoomConnection<Member>,
  ): void => {
    this.sockets.set(ws, connection);
    ws.serializeAttachment(connection);
  };

  private sendText = (ws: WebSocket, data: string): void => {
    try {
      ws.send(data);
    } catch {
      this.sockets.delete(ws);
    }
  };
}
