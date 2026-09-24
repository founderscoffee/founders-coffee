import { createDb, seed } from '@founders-coffee/db';
import { env } from 'cloudflare:test';

const WAIT_MS = 5_000;

export type Closure = { readonly code: number; readonly reason: string };

export type LiveClient = {
  readonly socket: WebSocket;
  readonly frames: readonly string[];
  readonly waitFor: (match: (frame: string) => boolean) => Promise<string>;
  readonly waitForClose: () => Promise<Closure>;
};

export type LiveRoom = {
  readonly eventId: string;
  readonly guestId: string;
  readonly hostToken: string;
  readonly guestToken: string;
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

/** The `type` of a JSON frame from the room. */
export const typeOf = (frame: string): unknown =>
  (JSON.parse(frame) as { type?: unknown }).type;

/**
 * Run `act` while D1 fails the room's membership query, then give the table back.
 *
 * With a table the query reads renamed away, D1 itself refuses the query, as it would in an outage,
 * and nothing is mocked.
 */
export const whileD1Fails = async <T>(act: () => Promise<T>): Promise<T> => {
  await env.DB.prepare(
    'ALTER TABLE event_rsvps RENAME TO event_rsvps_offline',
  ).run();
  try {
    return await act();
  } finally {
    await env.DB.prepare(
      'ALTER TABLE event_rsvps_offline RENAME TO event_rsvps',
    ).run();
  }
};

/**
 * Seed a published meetup with its host and one member going, each signed in for another hour.
 *
 * Every run gets its own identifiers, so the rooms of two tests never meet in the same object.
 */
export const seedLiveRoom = async (): Promise<LiveRoom> => {
  await seed(createDb(env.DB));
  const run = crypto.randomUUID();
  const hostId = `usr_live_host_${run}`;
  const guestId = `usr_live_guest_${run}`;
  const room = {
    eventId: `evt_live_${run}`,
    guestId,
    hostToken: `tok_host_${run}`,
    guestToken: `tok_guest_${run}`,
  };
  const now = Math.floor(Date.now() / 1000);
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO user (id, name, email) VALUES (?, ?, ?), (?, ?, ?)',
    ).bind(
      hostId,
      'Host',
      `${hostId}@example.com`,
      guestId,
      'Guest',
      `${guestId}@example.com`,
    ),
    env.DB.prepare(
      'INSERT INTO session (id, user_id, token, expires_at) VALUES (?, ?, ?, ?), (?, ?, ?, ?)',
    ).bind(
      `ses_host_${run}`,
      hostId,
      room.hostToken,
      now + 3600,
      `ses_guest_${run}`,
      guestId,
      room.guestToken,
      now + 3600,
    ),
    env.DB.prepare(
      `INSERT INTO events (id, host_id, market_code, state_code, city_code, title, description, venue, starts_at, language, slug)
       VALUES (?, ?, 'DZ', '16', '556', 'Live room', 'Live room', 'Café', ?, 'ar', ?)`,
    ).bind(room.eventId, hostId, now, `live-${run}`),
    env.DB.prepare(
      "INSERT INTO event_rsvps (id, event_id, user_id, status) VALUES (?, ?, ?, 'going')",
    ).bind(`rsvp_${run}`, room.eventId, guestId),
  ]);
  return room;
};

/** Better Auth's session cookie as a signed-in browser sends it: the token, then its signature. */
export const sessionCookie = (sessionToken: string): string =>
  `__Secure-better-auth.session_token=${sessionToken}.signature`;

/**
 * Open a socket to an event's live room with an upgrade carrying this Cookie header, or none.
 *
 * The client end is accepted and every frame kept, but nothing answers the server's close. That is
 * the client #84 describes, and the one that leaves a refused socket behind if the room forgets to.
 */
export const connectWithCookie = async (
  eventId: string,
  cookie?: string,
): Promise<LiveClient> => {
  const response = await liveRoomOf(eventId).fetch(
    new Request(`https://staging.founders.coffee/api/live/${eventId}`, {
      headers: { Upgrade: 'websocket', ...(cookie ? { Cookie: cookie } : {}) },
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

/**
 * Open a socket to an event's live room the way the browser does: an upgrade carrying the signed
 * session cookie, when there is one.
 */
export const connect = (
  eventId: string,
  sessionToken?: string,
): Promise<LiveClient> =>
  connectWithCookie(
    eventId,
    sessionToken ? sessionCookie(sessionToken) : undefined,
  );
