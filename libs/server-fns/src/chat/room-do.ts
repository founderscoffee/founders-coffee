import { DurableObject } from 'cloudflare:workers';

import { CHAT_ROOM_CLOSES } from '@founders-coffee/core';
import { createDb, readChatSocketSessions } from '@founders-coffee/db';

import { RoomConnections } from '../rooms/connections.js';
import {
  answerHeartbeats,
  armHeartbeat,
  reapStale,
} from '../rooms/heartbeat.js';
import { recheckMembers, refuse } from '../rooms/refusals.js';
import {
  verifySessionFromCookie,
  type MembershipLookup,
} from '../rooms/session.js';
import { chatRoomEventId } from './room-path.js';
import {
  CHAT_ROOM_REFUSALS,
  chatRoomMember,
  type ChatRoomFrame,
  type ChatRoomMember,
  type ChatRoomUpdate,
} from './room-protocol.js';
import { chatMessageView } from './view.js';

const EVENT_ID_KEY = 'eventId';
const MAX_SOCKETS_PER_MEMBER = 5;

type ChatRoomEnv = { readonly DB: D1Database };

export class EventChatDO extends DurableObject<ChatRoomEnv> {
  private connections: RoomConnections<ChatRoomMember, ChatRoomFrame>;

  /**
   * The room of one meetup's chat (P1-026): it holds the members' open sockets and pushes them what
   * happens in the chat, and nothing else. It keeps no message and no name, only the meetup's id, so
   * D1 stays the one record and erasing a member has nothing to reach here.
   *
   * It takes back the sockets the runtime still holds as it wakes, and has the runtime answer
   * heartbeats, as the live room does.
   */
  constructor(ctx: DurableObjectState, env: ChatRoomEnv) {
    super(ctx, env);
    this.connections = new RoomConnections(chatRoomMember, (ws) =>
      ctx.getWebSocketAutoResponseTimestamp(ws),
    );
    this.connections.restore(ctx.getWebSockets());
    answerHeartbeats(ctx);
  }

  /**
   * Take a browser's WebSocket upgrade for `/api/chat/<eventId>`, or answer 405.
   *
   * An upgrade is all a request can ask of the room. What a member says or does in the chat goes
   * through a server function, and what the room is told comes through its RPC methods, which only
   * code holding the `EVENT_CHAT` binding can call.
   */
  override fetch = async (request: Request): Promise<Response> => {
    const eventId = chatRoomEventId(new URL(request.url).pathname);
    if (
      request.method !== 'GET' ||
      request.headers.get('Upgrade') !== 'websocket' ||
      !eventId
    )
      return new Response('Method not allowed', { status: 405 });

    await this.ctx.storage.put(EVENT_ID_KEY, eventId);
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);
    this.connections.register(server, Date.now());

    const verdict = await verifySessionFromCookie(
      this.membership(eventId),
      request,
    );
    if (verdict.ok) this.admit(server, verdict.member);
    else refuse(this.connections, server, verdict.reason, CHAT_ROOM_REFUSALS);
    await armHeartbeat(this.ctx.storage, this.connections);
    return new Response(null, { status: 101, webSocket: client });
  };

  override webSocketMessage = (): void => undefined;

  override webSocketClose = async (ws: WebSocket): Promise<void> => {
    this.connections.drop(ws);
    await armHeartbeat(this.ctx.storage, this.connections);
  };

  override webSocketError = async (ws: WebSocket): Promise<void> => {
    this.connections.drop(ws);
    await armHeartbeat(this.ctx.storage, this.connections);
  };

  /**
   * Reap the sockets that stopped sending heartbeats, check every member left against the chat's
   * membership in one query, and arm the next deadline.
   *
   * This is where whatever the server functions cannot tell the room is caught: a ban, a closing
   * account, a suppressed host, the market switching the chat off, or an RSVP cancelled where the
   * room is not bound. Each is turned out within `HEARTBEAT_TIMEOUT_MS`. So is everyone, told the
   * chat has closed, once it has turned read-only: a meetup cancelled where the room is not bound,
   * as the nightly account closure cancels one, or a chat whose week after the meetup has run out.
   */
  // eslint-disable-next-line no-restricted-syntax -- Cloudflare RPC requires a prototype method.
  override async alarm(): Promise<void> {
    this.connections.restore(this.ctx.getWebSockets());
    reapStale(this.connections, Date.now());
    const eventId = await this.eventId();
    if (eventId)
      await recheckMembers({
        connections: this.connections,
        lookup: this.membership(eventId),
        refusals: CHAT_ROOM_REFUSALS,
      });
    await armHeartbeat(this.ctx.storage, this.connections);
  }

  /**
   * Push a message or a removal to every member in the room.
   *
   * A message goes to each member as their own screen shows it, from the stored row and the one
   * view the server functions answer with, so it matches what a page of the chat reads: the author
   * gets it back with the client id their device is waiting on, and nobody gets the author's email.
   */
  // eslint-disable-next-line no-restricted-syntax -- Cloudflare RPC requires a prototype method.
  async broadcast(update: ChatRoomUpdate): Promise<void> {
    if (update.type === 'removed') {
      this.connections.broadcast({
        type: 'removed',
        id: update.id,
        removal: update.removal,
      });
      return;
    }
    this.connections.broadcastEach((member) => ({
      type: 'message',
      message: chatMessageView(update.message, member.userId),
    }));
  }

  /**
   * Turn out `userId`'s sockets if the chat's membership no longer admits them, as a cancelled RSVP
   * leaves them.
   *
   * The room asks D1 rather than taking the caller's word, so a member who is going again by the
   * time it asks keeps their place, and so does the host, whose own RSVP never made them a member.
   */
  // eslint-disable-next-line no-restricted-syntax -- Cloudflare RPC requires a prototype method.
  async revoke(userId: string): Promise<void> {
    const eventId = await this.eventId();
    if (!eventId) return;
    await recheckMembers({
      connections: this.connections,
      lookup: this.membership(eventId),
      refusals: CHAT_ROOM_REFUSALS,
      isAsked: (member) => member.userId === userId,
    });
  }

  /**
   * Close the room of a chat that has closed for good, as a cancelled meetup's does: every socket
   * is told, then closed, and the heartbeat alarm goes, since nobody is left for it to check.
   */
  // eslint-disable-next-line no-restricted-syntax -- Cloudflare RPC requires a prototype method.
  async close(): Promise<void> {
    this.connections.restore(this.ctx.getWebSockets());
    this.connections.closeAll(CHAT_ROOM_REFUSALS.closed);
    await this.ctx.storage.deleteAlarm();
  }

  /**
   * Admit a member's socket, and have their oldest socket give way when they hold more than five.
   *
   * The newest is the screen they are looking at. The one that gives way is told it was superseded,
   * which its page takes as a reason to stop reconnecting rather than to take a socket back.
   */
  private admit = (ws: WebSocket, member: ChatRoomMember): void => {
    this.connections.admit(ws, member);
    const theirs = this.connections
      .entries()
      .filter(([, connection]) => connection.member?.userId === member.userId)
      .sort(([, a], [, b]) => a.registeredAt - b.registeredAt);
    for (const [oldest] of theirs.slice(
      0,
      Math.max(0, theirs.length - MAX_SOCKETS_PER_MEMBER),
    ))
      this.connections.close(
        oldest,
        CHAT_ROOM_CLOSES.superseded.code,
        CHAT_ROOM_CLOSES.superseded.reason,
      );
  };

  private membership =
    (eventId: string): MembershipLookup<ChatRoomMember> =>
    async (sessionTokens) => {
      const read = await readChatSocketSessions(createDb(this.env.DB), {
        eventId,
        sessionTokens,
      });
      return {
        isClosed: read.isReadOnly,
        sessions: read.sessions.map((session) => ({
          member: {
            userId: session.userId,
            sessionToken: session.sessionToken,
          },
          isMember: session.isMember,
        })),
      };
    };

  private eventId = async (): Promise<string | null> =>
    (await this.ctx.storage.get<string>(EVENT_ID_KEY)) ?? null;
}
