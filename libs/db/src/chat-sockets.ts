import { and, eq, gt, sql } from 'drizzle-orm';

import { isChatMember } from './chat-membership.js';
import type { Db } from './db.js';
import { chatChannels, events, session } from './schema.js';

export type ChatSocketSession = {
  readonly sessionToken: string;
  readonly userId: string;
  readonly isMember: boolean;
};

export type ChatSocketSessions = {
  readonly isReadOnly: boolean;
  readonly sessions: readonly ChatSocketSession[];
};

/**
 * The sessions among `sessionTokens` that are still signed in, each with whether its user belongs
 * to the chat of `eventId`, and whether that chat has turned read-only, in one query: what the
 * chat's room asks of a socket as it joins, and of every socket at once at each heartbeat alarm.
 *
 * A token that is unknown or has expired has no row. Membership is the predicate every read and
 * write of the chat keeps, asked of each session's user in the same statement. The meetup is joined
 * on the left, so a meetup that does not exist leaves a signed-in reader a non-member rather than
 * no session at all, and the room does not ask them to sign in again. The tokens travel as one JSON
 * array, since a room can hold more sockets than D1 takes bound parameters in a statement.
 *
 * Whether the chat is read-only rides on each session's row, from `read_only_at`, which a
 * cancellation sets to the moment it happens. With no session signed in there is no row to carry
 * it, and nobody for the room to tell.
 */
export const readChatSocketSessions = async (
  db: Db,
  input: {
    readonly eventId: string;
    readonly sessionTokens: readonly string[];
  },
): Promise<ChatSocketSessions> => {
  if (input.sessionTokens.length === 0)
    return { isReadOnly: false, sessions: [] };
  const rows = await db
    .select({
      sessionToken: session.token,
      userId: session.userId,
      isMember: sql`${isChatMember(sql`${session.userId}`)}`.mapWith(Boolean),
      isReadOnly:
        sql`coalesce(${chatChannels.readOnlyAt} <= unixepoch(), 0)`.mapWith(
          Boolean,
        ),
    })
    .from(session)
    .leftJoin(events, eq(events.id, input.eventId))
    .leftJoin(chatChannels, eq(chatChannels.eventId, input.eventId))
    .where(
      and(
        sql`${session.token} in (select value from json_each(${JSON.stringify(input.sessionTokens)}))`,
        gt(session.expiresAt, sql`unixepoch()`),
      ),
    );
  return {
    isReadOnly: rows.some((row) => row.isReadOnly),
    sessions: rows.map(({ sessionToken, userId, isMember }) => ({
      sessionToken,
      userId,
      isMember,
    })),
  };
};
