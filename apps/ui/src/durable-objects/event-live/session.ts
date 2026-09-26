import { sessionTokenFromCookie } from '@founders-coffee/auth';

import type { OutboundMessage } from './protocol.js';

interface D1PreparedStatement {
  bind: (...args: unknown[]) => D1PreparedStatement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
}

export interface D1Db {
  prepare: (query: string) => D1PreparedStatement;
}

export interface DoEnv {
  DB: D1Db;
}

export type RefusalReason = 'no_session' | 'not_allowed' | 'db_error';

export type VerifyResult =
  | {
      ok: true;
      userId: string;
      userName: string;
      isHost: boolean;
      sessionToken: string;
    }
  | { ok: false; reason: RefusalReason };

const MEMBERSHIP_QUERY = `SELECT s.token AS token, s.user_id AS user_id, u.name AS name, e.host_id AS host_id,
                EXISTS(SELECT 1 FROM event_rsvps WHERE event_id = e.id AND user_id = s.user_id AND status = 'going') AS rsvpd
         FROM session s
         JOIN user u ON s.user_id = u.id
         JOIN events e ON e.id = ?
         WHERE s.token IN (SELECT value FROM json_each(?)) AND s.expires_at > unixepoch()`;

type MembershipRow = {
  token: string;
  user_id: string;
  name: string;
  host_id: string;
  rsvpd: number;
};

const verdictFor = (
  row: MembershipRow | null | undefined,
  sessionToken: string,
): VerifyResult => {
  if (!row) return { ok: false, reason: 'no_session' };

  const isHost = row.user_id === row.host_id;
  if (!isHost && row.rsvpd !== 1) return { ok: false, reason: 'not_allowed' };

  return {
    ok: true,
    userId: row.user_id,
    userName: row.name,
    isHost,
    sessionToken,
  };
};

export const verifyEventSession = async (
  db: D1Db,
  eventId: string | null,
  sessionToken: string,
): Promise<VerifyResult> => {
  let row: MembershipRow | null;
  try {
    row = await db
      .prepare(MEMBERSHIP_QUERY)
      .bind(eventId, JSON.stringify([sessionToken]))
      .first<MembershipRow>();
  } catch {
    return { ok: false, reason: 'db_error' };
  }
  return verdictFor(row, sessionToken);
};

/**
 * Verify many sessions against one event in a single query, as the heartbeat alarm does for
 * everyone in the room (#87).
 *
 * It is `verifyEventSession`'s query and verdict, asked of every token at once, so the alarm and a
 * message can never disagree about the same socket. Every token gets a verdict. A database failure
 * gives them all `db_error`, which says nothing about anyone's session, so nobody is turned out for
 * it.
 */
export const verifyEventSessions = async (
  db: D1Db,
  eventId: string,
  sessionTokens: readonly string[],
): Promise<ReadonlyMap<string, VerifyResult>> => {
  let rows: readonly MembershipRow[];
  try {
    const { results } = await db
      .prepare(MEMBERSHIP_QUERY)
      .bind(eventId, JSON.stringify(sessionTokens))
      .all<MembershipRow>();
    rows = results;
  } catch {
    return new Map(
      sessionTokens.map((token): [string, VerifyResult] => [
        token,
        { ok: false, reason: 'db_error' },
      ]),
    );
  }
  const byToken = new Map(rows.map((row) => [row.token, row]));
  return new Map(
    sessionTokens.map((token): [string, VerifyResult] => [
      token,
      verdictFor(byToken.get(token), token),
    ]),
  );
};

/**
 * Verify the session in Better Auth's session cookie. The browser cannot read its own httpOnly
 * session cookie to send it as a message (L4), so the DO reads the Cookie header on upgrade instead.
 *
 * Only that cookie, so an upgrade costs one query however many cookies it carries, and none when it
 * carries no session. Anyone can open a socket here. Trying every cookie value in turn let an
 * upgrade padded with a thousand junk cookies hold the room for a thousand queries.
 *
 * A failed query stays `db_error`, which the upgrade asks the browser to retry. It says nothing
 * about the session, and answered as `no_session` it told a member whose session was fine that it
 * had expired.
 */
export const verifyEventSessionFromCookie = async (
  db: D1Db,
  eventId: string | null,
  request: Request,
): Promise<VerifyResult> => {
  const sessionToken = sessionTokenFromCookie(request.headers.get('Cookie'));
  if (!sessionToken) return { ok: false, reason: 'no_session' };

  return verifyEventSession(db, eventId, sessionToken);
};

/**
 * What the browser is told when a connection is refused, and whether the socket closes behind it.
 *
 * `not_allowed` and `no_session` used to share one `auth_expired` frame, so a signed-in member who
 * simply had not joined yet was told their session had ended and asked to refresh. That was false
 * about their account and the remedy did nothing, at the moment they were deciding whether to come
 * (#36). They are separate frames now, and the expiry copy belongs to an expiry alone.
 *
 * A database failure is the one refusal that may not be true a second later, so it is told as a
 * transient error, never as a verdict, and whether the socket stays depends on whether the room has
 * verified it. A verified socket stays open: the failure says nothing about its session, which is
 * asked again at the next alarm or message. A socket still joining is closed with 1013, Try Again
 * Later, because left open it would sit in the room unverified with nothing coming to settle it.
 * The browser stops for neither that frame nor that close, so its reconnect loop joins again.
 *
 * A connection that holds when it joins is asked again at every heartbeat alarm, and before each
 * message that changes the room, but not in between. Heartbeats no longer reach the room (#85), so
 * a withdrawn RSVP, an expired login or a signed-out session is now turned out within
 * `HEARTBEAT_TIMEOUT_MS` (45 s), where the 15 s heartbeat used to catch it sooner. That window is
 * the price #87 chose for one query per alarm instead of one per socket per heartbeat. A cancelled
 * meetup does not wait for it: cancellation closes the room at once, on its own path.
 */
export const refusalFor = (
  reason: RefusalReason,
  { isVerified }: { isVerified: boolean },
): {
  message: OutboundMessage;
  close: { code: number; reason: string } | null;
} => {
  if (reason === 'db_error')
    return {
      message: { type: 'error', message: 'Temporary auth error, please retry' },
      close: isVerified ? null : { code: 1013, reason: 'try_again_later' },
    };
  if (reason === 'not_allowed')
    return {
      message: { type: 'not_attending', message: 'Not attending this event' },
      close: { code: 4003, reason: 'not_attending' },
    };
  return {
    message: { type: 'auth_expired', message: 'Session expired' },
    close: { code: 4001, reason: 'auth_expired' },
  };
};
