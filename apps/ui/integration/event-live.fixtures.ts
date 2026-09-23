import { env } from 'cloudflare:test';

const WAIT_MS = 5_000;

export type Closure = { readonly code: number; readonly reason: string };

export type LiveClient = {
  readonly socket: WebSocket;
  readonly frames: readonly string[];
  readonly waitFor: (match: (frame: string) => boolean) => Promise<string>;
  readonly waitForClose: () => Promise<Closure>;
};

/** The object holding one event's live room, addressed the way `server.ts` addresses it. */
export const liveRoomOf = (eventId: string) =>
  env.EVENT_LIVE.get(env.EVENT_LIVE.idFromName(`event:${eventId}`));

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
 * Open a socket to an event's live room the way the browser does: an upgrade carrying the signed
 * session cookie, when there is one.
 *
 * The client end is accepted and every frame kept, but nothing answers the server's close. That is
 * the client #84 describes, and the one that leaves a refused socket behind if the room forgets to.
 */
export const connect = async (
  eventId: string,
  sessionToken?: string,
): Promise<LiveClient> => {
  const response = await liveRoomOf(eventId).fetch(
    new Request(`https://staging.founders.coffee/api/live/${eventId}`, {
      headers: {
        Upgrade: 'websocket',
        ...(sessionToken
          ? { Cookie: `better-auth.session_token=${sessionToken}.signature` }
          : {}),
      },
    }),
  );
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
