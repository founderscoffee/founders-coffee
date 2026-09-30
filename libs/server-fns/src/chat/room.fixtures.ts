import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';

import { id } from '@founders-coffee/core';
import { session, type Db } from '@founders-coffee/db';

import type { EventChatDO } from './room-do.js';
import { chatRoomName } from './room-path.js';

const WAIT_MS = 5_000;

export const ORIGIN = 'https://founders.coffee';

export type Closure = { readonly code: number; readonly reason: string };

export type ChatClient = {
  readonly socket: WebSocket;
  readonly frames: readonly string[];
  readonly waitFor: (match: (frame: string) => boolean) => Promise<string>;
  readonly waitForClose: () => Promise<Closure>;
};

const namespace = (): DurableObjectNamespace<EventChatDO> =>
  (env as unknown as { EVENT_CHAT: DurableObjectNamespace<EventChatDO> })
    .EVENT_CHAT;

/** The room of a meetup's chat, addressed the way the route and the server functions address it. */
export const roomOf = (eventId: string): DurableObjectStub<EventChatDO> =>
  namespace().get(namespace().idFromName(chatRoomName(eventId)));

/** Sign `userId` in for another hour, and return the session's token. */
export const signIn = async (db: Db, userId: string): Promise<string> => {
  const token = id('tok');
  await db.insert(session).values({
    id: id('ses'),
    userId,
    token,
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  return token;
};

/** Better Auth's session cookie as a signed-in browser sends it: the token, then its signature. */
export const sessionCookie = (sessionToken: string): string =>
  `__Secure-better-auth.session_token=${sessionToken}.signature`;

/** Match a JSON frame from the room by its `type`, and nothing that is not JSON. */
export const ofType =
  (type: string) =>
  (frame: string): boolean => {
    try {
      return (JSON.parse(frame) as { type?: unknown }).type === type;
    } catch {
      return false;
    }
  };

/**
 * Take the socket an upgrade was answered with, and keep every frame it hears.
 *
 * The client end is accepted and every frame kept, but nothing answers the server's close, as with
 * the client #84 describes, which leaves a refused socket behind if the room forgets to.
 */
export const listen = (response: Response): ChatClient => {
  const socket = response.webSocket;
  if (!socket) throw new Error(`The room answered ${response.status}`);
  const frames: string[] = [];
  let closure: Closure | undefined;
  const listeners = new Set<() => void>();
  const notify = (): void => {
    for (const listener of listeners) listener();
  };
  socket.accept();
  socket.addEventListener('message', (event) => {
    frames.push(String(event.data));
    notify();
  });
  socket.addEventListener('close', (event) => {
    closure = { code: event.code, reason: event.reason };
    notify();
  });
  const until = <T>(read: () => T | undefined, failure: string): Promise<T> =>
    new Promise((resolve, reject) => {
      const check = (): void => {
        const value = read();
        if (value === undefined) return;
        listeners.delete(check);
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => {
        listeners.delete(check);
        reject(new Error(`${failure}; saw ${JSON.stringify(frames)}`));
      }, WAIT_MS);
      listeners.add(check);
      check();
    });
  return {
    socket,
    frames,
    waitFor: (match) => until(() => frames.find(match), 'No matching frame'),
    waitForClose: () => until(() => closure, 'Still open'),
  };
};

/** The upgrade a browser sends for a meetup's chat, carrying the session cookie when there is one. */
export const upgradeFor = (
  eventId: string,
  sessionToken?: string,
  headers: Record<string, string> = {},
): Request =>
  new Request(`${ORIGIN}/api/chat/${eventId}`, {
    headers: {
      Upgrade: 'websocket',
      ...(sessionToken ? { Cookie: sessionCookie(sessionToken) } : {}),
      ...headers,
    },
  });

/** Open a socket straight to a meetup's chat room, signed in with `sessionToken` or not at all. */
export const connect = async (
  eventId: string,
  sessionToken?: string,
): Promise<ChatClient> =>
  listen(await roomOf(eventId).fetch(upgradeFor(eventId, sessionToken)));

/** The members whose sockets the room holds as verified, one entry per socket. */
export const membersIn = (eventId: string): Promise<readonly string[]> =>
  runInDurableObject(roomOf(eventId), (instance: EventChatDO) =>
    instance['connections'].members().map(([, member]) => member.userId),
  );

/** Age every socket in the room as if it had been registered a heartbeat timeout ago. */
export const registeredLongAgo = (
  eventId: string,
  timeoutMs: number,
): Promise<void> =>
  runInDurableObject(roomOf(eventId), (_instance: EventChatDO, state) => {
    for (const socket of state.getWebSockets())
      socket.serializeAttachment({
        ...(socket.deserializeAttachment() as Record<string, unknown>),
        registeredAt: Date.now() - timeoutMs,
      });
  });
