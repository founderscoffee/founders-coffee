import { z } from 'zod';

import type {
  MembershipLookup,
  RoomRefusals,
} from '@founders-coffee/server-fns/rooms';

import type { OutboundMessage } from './protocol.js';

export interface DoEnv {
  DB: D1Database;
}

export const liveMember = z.object({
  userId: z.string(),
  userName: z.string(),
  isHost: z.boolean(),
  sessionToken: z.string(),
});

export type LiveMember = z.infer<typeof liveMember>;

const MEMBERSHIP_QUERY = `SELECT s.token AS token, s.user_id AS user_id, u.name AS name, e.host_id AS host_id, e.status AS status,
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
  status: string;
  rsvpd: number;
};

/**
 * The live room's membership for `eventId`: the meetup's host or someone going, for every session
 * among the tokens that is still signed in, in one query, as the shared room code asks it.
 *
 * A connection that holds when it joins is asked again at every heartbeat alarm, and before each
 * message that changes the room, but not in between. Heartbeats no longer reach the room (#85), so
 * a withdrawn RSVP, an expired login or a signed-out session is turned out within
 * `HEARTBEAT_TIMEOUT_MS` (45 s), where the 15 s heartbeat used to catch it sooner. That window is
 * the price #87 chose for one query per alarm instead of one per socket per heartbeat. A cancelled
 * meetup does not wait for it: cancellation closes the room at once, on its own path. A meetup
 * cancelled where the room is not bound, as the nightly account closure cancels one, closes it at
 * the next alarm instead, since the room reads the meetup's status in the same query.
 */
export const liveMembership =
  (db: D1Database, eventId: string | null): MembershipLookup<LiveMember> =>
  async (sessionTokens) => {
    const { results } = await db
      .prepare(MEMBERSHIP_QUERY)
      .bind(eventId, JSON.stringify(sessionTokens))
      .all<MembershipRow>();
    return {
      isClosed: results.some((row) => row.status === 'cancelled'),
      sessions: results.map((row) => {
        const isHost = row.user_id === row.host_id;
        return {
          member: {
            userId: row.user_id,
            userName: row.name,
            isHost,
            sessionToken: row.token,
          },
          isMember: isHost || row.rsvpd === 1,
        };
      }),
    };
  };

export const LIVE_REFUSALS: RoomRefusals<OutboundMessage> = {
  notAllowed: {
    frame: { type: 'not_attending', message: 'Not attending this event' },
    close: { code: 4003, reason: 'not_attending' },
  },
  noSession: {
    frame: { type: 'auth_expired', message: 'Session expired' },
    close: { code: 4001, reason: 'auth_expired' },
  },
  closed: {
    frame: { type: 'event_cancelled' },
    close: { code: 4003, reason: 'event_cancelled' },
  },
  unavailable: {
    type: 'error',
    message: 'Temporary auth error, please retry',
  },
};
