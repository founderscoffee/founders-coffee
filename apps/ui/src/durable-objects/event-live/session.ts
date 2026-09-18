interface D1PreparedStatement {
  bind: (...args: unknown[]) => D1PreparedStatement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
}

export interface D1Db {
  prepare: (query: string) => D1PreparedStatement;
}

export interface DoEnv {
  DB: D1Db;
}

export type VerifyResult =
  | {
      ok: true;
      userId: string;
      userName: string;
      isHost: boolean;
      sessionToken: string;
    }
  | { ok: false; reason: 'no_session' | 'not_allowed' | 'db_error' };

const MEMBERSHIP_QUERY = `SELECT s.user_id AS user_id, u.name AS name, e.host_id AS host_id,
                EXISTS(SELECT 1 FROM event_rsvps WHERE event_id = e.id AND user_id = s.user_id AND status = 'going') AS rsvpd
         FROM session s
         JOIN user u ON s.user_id = u.id
         JOIN events e ON e.id = ?
         WHERE s.token = ? AND s.expires_at > unixepoch()`;

export const verifyEventSession = async (
  db: D1Db,
  eventId: string | null,
  sessionToken: string,
): Promise<VerifyResult> => {
  let row: {
    user_id: string;
    name: string;
    host_id: string;
    rsvpd: number;
  } | null;

  try {
    row = await db
      .prepare(MEMBERSHIP_QUERY)
      .bind(eventId, sessionToken)
      .first();
  } catch {
    return { ok: false, reason: 'db_error' };
  }

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

/**
 * Try every cookie value as a session token. The browser cannot read its own httpOnly session
 * cookie to send it as a message (L4), so the DO reads the Cookie header on upgrade instead. A
 * `not_allowed` result short-circuits: the token was valid, the membership was not.
 */
export const verifyEventSessionFromCookie = async (
  db: D1Db,
  eventId: string | null,
  request: Request,
): Promise<VerifyResult> => {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return { ok: false, reason: 'no_session' };

  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const value = part.slice(eq + 1).trim();
    if (!value) continue;
    const result = await verifyEventSession(db, eventId, value);
    if (result.ok || (!result.ok && result.reason === 'not_allowed')) {
      return result;
    }
  }
  return { ok: false, reason: 'no_session' };
};
