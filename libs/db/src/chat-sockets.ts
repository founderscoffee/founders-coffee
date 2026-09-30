import { and, eq, gt, sql } from 'drizzle-orm';

import { isChatMember } from './chat-membership.js';
import type { Db } from './db.js';
import { events, session } from './schema.js';

export type ChatSocketSession = {
  readonly sessionToken: string;
  readonly userId: string;
  readonly isMember: boolean;
};

/**
 * The sessions among `sessionTokens` that are still signed in, each with whether its user belongs
 * to the chat of `eventId`, in one query: what the chat's room asks of a socket as it joins, and of
 * every socket at once at each heartbeat alarm.
 *
 * A token that is unknown or has expired has no row. Membership is the predicate every read and
 * write of the chat keeps, asked of each session's user in the same statement. The meetup is joined
 * on the left, so a meetup that does not exist leaves a signed-in reader a non-member rather than
 * no session at all, and the room does not ask them to sign in again. The tokens travel as one JSON
 * array, since a room can hold more sockets than D1 takes bound parameters in a statement.
 */
export const readChatSocketSessions = async (
  db: Db,
  input: {
    readonly eventId: string;
    readonly sessionTokens: readonly string[];
  },
): Promise<ChatSocketSession[]> => {
  if (input.sessionTokens.length === 0) return [];
  return db
    .select({
      sessionToken: session.token,
      userId: session.userId,
      isMember: sql`${isChatMember(sql`${session.userId}`)}`.mapWith(Boolean),
    })
    .from(session)
    .leftJoin(events, eq(events.id, input.eventId))
    .where(
      and(
        sql`${session.token} in (select value from json_each(${JSON.stringify(input.sessionTokens)}))`,
        gt(session.expiresAt, sql`unixepoch()`),
      ),
    );
};
