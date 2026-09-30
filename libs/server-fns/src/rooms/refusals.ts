import { ROOM_TRY_AGAIN_LATER_CLOSE } from '@founders-coffee/core';

import type { RoomConnections, RoomMember } from './connections.js';
import {
  verifySession,
  verifySessions,
  type MembershipLookup,
  type RoomRefusal,
} from './session.js';

export type RoomClose = { readonly code: number; readonly reason: string };

export type RoomNotice<Frame> = {
  readonly frame: Frame | null;
  readonly close: RoomClose;
};

export type RoomRefusals<Frame> = {
  readonly notAllowed: RoomNotice<Frame>;
  readonly noSession: RoomNotice<Frame>;
  readonly unavailable: Frame | null;
};

/**
 * Tell a socket why the room refuses it, in the room's own words, and close it unless the refusal
 * may not hold a second later.
 *
 * A signed-in reader the room does not admit and one whose session has ended are told apart. They
 * once shared the live room's `auth_expired` frame, so a signed-in member who simply had not joined
 * yet was told their session had ended and asked to refresh: false about their account, at the
 * moment they were deciding whether to come (#36).
 *
 * A database failure is the one refusal that may not be true a second later, so it is never told
 * as a verdict, and whether the socket stays depends on whether the room has verified it, which is
 * read from the room rather than taken from the caller. A verified socket stays open: the failure
 * says nothing about its session, which is asked again at the next alarm. A socket still joining is
 * closed with 1013, Try Again Later, because left open it would sit in the room unverified with
 * nothing coming to settle it. The browser stops for neither, so its reconnect loop joins again.
 *
 * Closing goes through `RoomConnections.close`, which forgets the socket before closing it. A
 * refusal that closed the socket directly left it in the room's map (#84).
 */
export const refuse = <Member extends RoomMember, Frame>(
  connections: RoomConnections<Member, Frame>,
  ws: WebSocket,
  reason: RoomRefusal,
  refusals: RoomRefusals<Frame>,
): void => {
  if (reason === 'db_error') {
    if (refusals.unavailable) connections.send(ws, refusals.unavailable);
    if (!connections.get(ws)?.member)
      connections.close(
        ws,
        ROOM_TRY_AGAIN_LATER_CLOSE.code,
        ROOM_TRY_AGAIN_LATER_CLOSE.reason,
      );
    return;
  }
  const notice =
    reason === 'not_allowed' ? refusals.notAllowed : refusals.noSession;
  if (notice.frame) connections.send(ws, notice.frame);
  connections.close(ws, notice.close.code, notice.close.reason);
};

/**
 * Check one verified socket's session again, and refresh who it belongs to while it still holds.
 *
 * Its refusals are the upgrade's, so a member whose place was withdrawn hears the same words they
 * would on joining, not that their session expired. A socket the room has not verified yet is left
 * to its own upgrade.
 */
export const recheckMember = async <Member extends RoomMember, Frame>(args: {
  connections: RoomConnections<Member, Frame>;
  ws: WebSocket;
  lookup: MembershipLookup<Member>;
  refusals: RoomRefusals<Frame>;
}): Promise<boolean> => {
  const { connections, ws, lookup, refusals } = args;
  const member = connections.get(ws)?.member;
  if (!member) return true;
  const verdict = await verifySession(lookup, member.sessionToken);
  if (verdict.ok) {
    connections.admit(ws, verdict.member);
    return true;
  }
  refuse(connections, ws, verdict.reason, refusals);
  return false;
};

/**
 * Check every verified socket in the room with one lookup, and turn out those that no longer hold
 * (#87).
 *
 * A database failure turns nobody out. The question is asked again at the next alarm.
 */
export const recheckMembers = async <Member extends RoomMember, Frame>(args: {
  connections: RoomConnections<Member, Frame>;
  lookup: MembershipLookup<Member>;
  refusals: RoomRefusals<Frame>;
}): Promise<void> => {
  const { connections, lookup, refusals } = args;
  const asked = connections.members();
  if (asked.length === 0) return;

  const verdicts = await verifySessions(
    lookup,
    asked.map(([, member]) => member.sessionToken),
  );
  for (const [ws, member] of asked) {
    const verdict = verdicts.get(member.sessionToken);
    if (verdict && !verdict.ok && verdict.reason !== 'db_error')
      refuse(connections, ws, verdict.reason, refusals);
  }
};
