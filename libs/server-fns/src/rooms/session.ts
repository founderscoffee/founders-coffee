import { sessionTokenFromCookie } from '@founders-coffee/auth';

import type { RoomMember } from './connections.js';

export type RoomRefusal = 'no_session' | 'not_allowed' | 'db_error';

export type SessionVerdict<Member extends RoomMember> =
  | { readonly ok: true; readonly member: Member }
  | { readonly ok: false; readonly reason: RoomRefusal };

export type RoomSession<Member extends RoomMember> = {
  readonly member: Member;
  readonly isMember: boolean;
};

export type MembershipLookup<Member extends RoomMember> = (
  sessionTokens: readonly string[],
) => Promise<readonly RoomSession<Member>[]>;

const verdictFor = <Member extends RoomMember>(
  session: RoomSession<Member> | undefined,
): SessionVerdict<Member> => {
  if (!session) return { ok: false, reason: 'no_session' };
  if (!session.isMember) return { ok: false, reason: 'not_allowed' };
  return { ok: true, member: session.member };
};

/**
 * Verify many sessions against one room in a single lookup, as the heartbeat alarm does for
 * everyone in the room (#87).
 *
 * A room's lookup answers for the sessions still signed in, with whether each one's user belongs
 * to the room; the verdict is the same for one socket joining and for the whole room at an alarm,
 * so the two can never disagree about the same socket. Every token gets a verdict: one the lookup
 * has no session for is `no_session`, and one whose user is not a member is `not_allowed`. A
 * failed lookup gives them all `db_error`, which says nothing about anyone's session, so nobody is
 * turned out for it.
 */
export const verifySessions = async <Member extends RoomMember>(
  lookup: MembershipLookup<Member>,
  sessionTokens: readonly string[],
): Promise<ReadonlyMap<string, SessionVerdict<Member>>> => {
  let sessions: readonly RoomSession<Member>[];
  try {
    sessions = await lookup(sessionTokens);
  } catch {
    return new Map(
      sessionTokens.map((token): [string, SessionVerdict<Member>] => [
        token,
        { ok: false, reason: 'db_error' },
      ]),
    );
  }
  const byToken = new Map(
    sessions.map((session) => [session.member.sessionToken, session]),
  );
  return new Map(
    sessionTokens.map((token): [string, SessionVerdict<Member>] => [
      token,
      verdictFor(byToken.get(token)),
    ]),
  );
};

/** Verify one session against a room, by {@link verifySessions}'s lookup and verdict. */
export const verifySession = async <Member extends RoomMember>(
  lookup: MembershipLookup<Member>,
  sessionToken: string,
): Promise<SessionVerdict<Member>> =>
  (await verifySessions(lookup, [sessionToken])).get(sessionToken) ?? {
    ok: false,
    reason: 'no_session',
  };

/**
 * Verify the session in Better Auth's session cookie. The browser cannot read its own httpOnly
 * session cookie to send it as a message (L4), so a room reads the Cookie header on upgrade
 * instead.
 *
 * Only that cookie, so an upgrade costs one lookup however many cookies it carries, and none when
 * it carries no session. Anyone can open a socket here. Trying every cookie value in turn let an
 * upgrade padded with a thousand junk cookies hold the live room for a thousand queries.
 *
 * A failed lookup stays `db_error`, which the upgrade asks the browser to retry. It says nothing
 * about the session, and answered as `no_session` it told a member whose session was fine that it
 * had expired.
 */
export const verifySessionFromCookie = async <Member extends RoomMember>(
  lookup: MembershipLookup<Member>,
  request: Request,
): Promise<SessionVerdict<Member>> => {
  const sessionToken = sessionTokenFromCookie(request.headers.get('Cookie'));
  if (!sessionToken) return { ok: false, reason: 'no_session' };
  return verifySession(lookup, sessionToken);
};
