import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { ROOM_TRY_AGAIN_LATER_CLOSE } from '@founders-coffee/core';

import { RoomConnections } from './connections.js';
import { recheckMember, recheckMembers, refuse } from './refusals.js';
import type { MembershipLookup } from './session.js';
import { verifySessionFromCookie, verifySessions } from './session.js';

const socket = (): WebSocket =>
  ({
    readyState: WebSocket.OPEN,
    serializeAttachment: vi.fn(),
    deserializeAttachment: vi.fn(() => null),
    send: vi.fn(),
    close: vi.fn(),
  }) as unknown as WebSocket;

const member = z.object({
  userId: z.string(),
  userName: z.string(),
  sessionToken: z.string(),
});

type Member = z.infer<typeof member>;
type Frame = { type: string };

const refusals = {
  notAllowed: {
    frame: { type: 'not_attending' },
    close: { code: 4003, reason: 'not_attending' },
  },
  noSession: { frame: null, close: { code: 4001, reason: 'auth_expired' } },
  unavailable: { type: 'error' },
};

const room = () => new RoomConnections<Member, Frame>(member, () => null);

const joined = (connections: RoomConnections<Member, Frame>, who?: Member) => {
  const ws = socket();
  connections.register(ws, 10);
  if (who) connections.admit(ws, who);
  return ws;
};

const amina = { userId: 'user-1', userName: 'Amina', sessionToken: 'tok-1' };

/** A room's membership as a plain answer, one session per member given, going or not. */
const lookupOf =
  (sessions: readonly { member: Member; isMember: boolean }[]) =>
  async (tokens: readonly string[]) =>
    sessions.filter((session) => tokens.includes(session.member.sessionToken));

const failing: MembershipLookup<Member> = async () => {
  throw new Error('D1 is down');
};

describe("a room's verdict on a session", () => {
  it('tells no session, not a member and a member apart, and a failed lookup from all three', async () => {
    const lookup = lookupOf([
      { member: amina, isMember: true },
      {
        member: { ...amina, userId: 'user-2', sessionToken: 'tok-2' },
        isMember: false,
      },
    ]);

    const verdicts = await verifySessions(lookup, ['tok-1', 'tok-2', 'tok-3']);
    const down = await verifySessions(failing, ['tok-1']);

    expect([...verdicts.values()]).toEqual([
      { ok: true, member: amina },
      { ok: false, reason: 'not_allowed' },
      { ok: false, reason: 'no_session' },
    ]);
    expect(down.get('tok-1')).toEqual({ ok: false, reason: 'db_error' });
  });

  it('reads the unsigned token from the session cookie, and asks nothing without one', async () => {
    const lookup = vi.fn(lookupOf([{ member: amina, isMember: true }]));
    const withCookie = new Request('https://founders.coffee', {
      headers: { cookie: '__Secure-better-auth.session_token=tok-1.signature' },
    });

    expect(await verifySessionFromCookie(lookup, withCookie)).toEqual({
      ok: true,
      member: amina,
    });
    expect(
      await verifySessionFromCookie(
        lookup,
        new Request('https://founders.coffee'),
      ),
    ).toEqual({ ok: false, reason: 'no_session' });
    expect(lookup).toHaveBeenCalledTimes(1);
  });
});

describe('how a refusal is told to the browser', () => {
  it("tells a reader who is not a member apart from one whose session ended, in the room's words", () => {
    const connections = room();
    const outsider = joined(connections);
    const expired = joined(connections);

    refuse(connections, outsider, 'not_allowed', refusals);
    refuse(connections, expired, 'no_session', refusals);

    expect(outsider.send).toHaveBeenCalledWith('{"type":"not_attending"}');
    expect(outsider.close).toHaveBeenCalledWith(4003, 'not_attending');
    expect(expired.send).not.toHaveBeenCalled();
    expect(expired.close).toHaveBeenCalledWith(4001, 'auth_expired');
    expect(connections.size()).toBe(0);
  });

  it('leaves a verified socket open on a database failure, and asks a joining one to try again', () => {
    const connections = room();
    const verified = joined(connections, amina);
    const joining = joined(connections);

    refuse(connections, verified, 'db_error', refusals);
    refuse(connections, joining, 'db_error', refusals);

    expect(verified.send).toHaveBeenCalledWith('{"type":"error"}');
    expect(verified.close).not.toHaveBeenCalled();
    expect(joining.close).toHaveBeenCalledWith(
      ROOM_TRY_AGAIN_LATER_CLOSE.code,
      ROOM_TRY_AGAIN_LATER_CLOSE.reason,
    );
    expect(connections.members()).toEqual([[verified, amina]]);
  });
});

describe('checking members again', () => {
  it('refreshes who a socket belongs to while its session still holds', async () => {
    const connections = room();
    const ws = joined(connections, amina);
    const renamed = { ...amina, userName: 'Amina B.' };

    expect(
      await recheckMember({
        connections,
        ws,
        lookup: lookupOf([{ member: renamed, isMember: true }]),
        refusals,
      }),
    ).toBe(true);
    expect(connections.get(ws)?.member).toEqual(renamed);
  });

  it('turns out the members who no longer hold, and nobody when the lookup fails', async () => {
    const connections = room();
    const yacine = {
      userId: 'user-2',
      userName: 'Yacine',
      sessionToken: 'tok-2',
    };
    const aminaSocket = joined(connections, amina);
    const yacineSocket = joined(connections, yacine);
    const yacineLeft = lookupOf([
      { member: amina, isMember: true },
      { member: yacine, isMember: false },
    ]);

    await recheckMembers({ connections, lookup: failing, refusals });
    await recheckMembers({ connections, lookup: yacineLeft, refusals });

    expect(aminaSocket.close).not.toHaveBeenCalled();
    expect(yacineSocket.close).toHaveBeenCalledWith(4003, 'not_attending');
    expect(connections.members()).toEqual([[aminaSocket, amina]]);
  });
});
