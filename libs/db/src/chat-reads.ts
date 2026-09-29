import { alias } from 'drizzle-orm/sqlite-core';
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gt,
  lt,
  or,
  sql,
} from 'drizzle-orm';

import { batch } from './atomic.js';
import { isChatMember } from './chat-membership.js';
import type { Db } from './db.js';
import { visibleIdentity } from './profile-access.js';
import {
  chatChannels,
  chatMembers,
  chatMessages,
  events,
  memberProfiles,
  user,
  type ChatMessageRow,
} from './schema.js';

export type ChatMessageCursor = { readonly at: number; readonly id: string };

export type ChatMessageWithAuthor = ChatMessageRow & {
  readonly authorName: string | null;
  readonly authorEmail: string | null;
  readonly authorPhotoAssetId: string | null;
};

export type ChatAccess = {
  readonly marketCode: string;
  readonly hostId: string;
  readonly channelId: string | null;
  readonly readOnlyAt: Date | null;
  readonly isMember: boolean;
};

export type ChatMemberState = {
  readonly lastReadAt: Date | null;
  readonly muted: boolean;
};

/**
 * Messages with their chat, its meetup and each author's name and photo, for a caller to narrow.
 *
 * The author is joined only while their identity is visible, by the rule every public read keeps,
 * so a banned or closing member's name and photo read as nobody's and the screen says "Member".
 * Their email comes too, for the caller to check the name against, never to show. The joined
 * identity is aliased because the membership rule asks its own question of `user` in a subquery
 * that must not read this row's copy.
 */
export const messagesWithAuthors = (db: Db) => {
  const author = alias(user, 'chat_author');
  return db
    .select({
      ...getTableColumns(chatMessages),
      authorName: author.name,
      authorEmail: author.email,
      authorPhotoAssetId: memberProfiles.photoAssetId,
    })
    .from(chatMessages)
    .innerJoin(chatChannels, eq(chatChannels.id, chatMessages.channelId))
    .innerJoin(events, eq(events.id, chatChannels.eventId))
    .leftJoin(
      author,
      and(
        eq(author.id, chatMessages.authorId),
        visibleIdentity(chatMessages.authorId),
      ),
    )
    .leftJoin(memberProfiles, eq(memberProfiles.userId, author.id));
};

/** The condition for the messages strictly past `cursor`, older or newer, in the chat's order. */
const pastCursor = (cursor: ChatMessageCursor, side: 'before' | 'after') => {
  const at = new Date(cursor.at);
  return side === 'after'
    ? or(
        gt(chatMessages.createdAt, at),
        and(eq(chatMessages.createdAt, at), gt(chatMessages.id, cursor.id)),
      )
    : or(
        lt(chatMessages.createdAt, at),
        and(eq(chatMessages.createdAt, at), lt(chatMessages.id, cursor.id)),
      );
};

/** The meetup, its chat and whether `viewerId` is a member of it, as one row or none. */
const chatAccess = (db: Db, eventId: string, viewerId: string) =>
  db
    .select({
      marketCode: events.marketCode,
      hostId: events.hostId,
      channelId: chatChannels.id,
      readOnlyAt: chatChannels.readOnlyAt,
      isMember: sql`${isChatMember(viewerId)}`.mapWith(Boolean),
    })
    .from(events)
    .leftJoin(chatChannels, eq(chatChannels.eventId, events.id))
    .where(eq(events.id, eventId))
    .limit(1);

/**
 * Up to `limit` messages of the chat of `eventId`, for a member only, on the `(created_at, id)`
 * cursor its index carries: the newest first, or the oldest first when reading `after` a cursor.
 */
const chatMessageRows = (
  db: Db,
  input: {
    readonly eventId: string;
    readonly viewerId: string;
    readonly before?: ChatMessageCursor;
    readonly after?: ChatMessageCursor;
    readonly limit: number;
  },
) =>
  messagesWithAuthors(db)
    .where(
      and(
        eq(chatChannels.eventId, input.eventId),
        isChatMember(input.viewerId),
        input.before ? pastCursor(input.before, 'before') : undefined,
        input.after ? pastCursor(input.after, 'after') : undefined,
      ),
    )
    .orderBy(
      ...(input.after
        ? [asc(chatMessages.createdAt), asc(chatMessages.id)]
        : [desc(chatMessages.createdAt), desc(chatMessages.id)]),
    )
    .limit(input.limit);

/** What `viewerId` chose for the chat of `eventId`, if they have read or muted it. */
const chatMemberState = (db: Db, eventId: string, viewerId: string) =>
  db
    .select({ lastReadAt: chatMembers.lastReadAt, muted: chatMembers.muted })
    .from(chatMembers)
    .innerJoin(chatChannels, eq(chatChannels.id, chatMembers.channelId))
    .where(
      and(eq(chatChannels.eventId, eventId), eq(chatMembers.userId, viewerId)),
    )
    .limit(1);

/**
 * What a chat's panel reads when it opens, in one trip to D1: the meetup, its chat and whether the
 * reader is a member, the latest page of messages with their authors, oldest first, and the
 * reader's own read marker and mute.
 *
 * Every message is read under the membership rule too, so a reader who is not a member gets none
 * back rather than a page the caller has to remember to withhold. One message past the page says
 * whether there are older ones.
 */
export const readChatPage = async (
  db: Db,
  input: {
    readonly eventId: string;
    readonly viewerId: string;
    readonly limit: number;
  },
): Promise<{
  readonly access: ChatAccess | undefined;
  readonly messages: ChatMessageWithAuthor[];
  readonly hasOlder: boolean;
  readonly member: ChatMemberState | undefined;
}> => {
  const [access, rows, member] = await batch(db, [
    chatAccess(db, input.eventId, input.viewerId),
    chatMessageRows(db, { ...input, limit: input.limit + 1 }),
    chatMemberState(db, input.eventId, input.viewerId),
  ]);
  const newestFirst = rows as ChatMessageWithAuthor[];
  return {
    access: (access as ChatAccess[])[0],
    messages: newestFirst.slice(0, input.limit).reverse(),
    hasOlder: newestFirst.length > input.limit,
    member: (member as ChatMemberState[])[0],
  };
};

/**
 * One page of a chat's messages for a member, oldest first, with whether there are more past it.
 *
 * `before` pages back into the history and `after` fills the gap a reconnect left, reading forward
 * from the newest message the reader holds; `hasMore` is about the side being read. The access row
 * comes in the same trip, so the caller can tell a reader who is not a member from an empty page.
 */
export const readChatMessages = async (
  db: Db,
  input: {
    readonly eventId: string;
    readonly viewerId: string;
    readonly before?: ChatMessageCursor;
    readonly after?: ChatMessageCursor;
    readonly limit: number;
  },
): Promise<{
  readonly access: ChatAccess | undefined;
  readonly messages: ChatMessageWithAuthor[];
  readonly hasMore: boolean;
}> => {
  const [access, rows] = await batch(db, [
    chatAccess(db, input.eventId, input.viewerId),
    chatMessageRows(db, { ...input, limit: input.limit + 1 }),
  ]);
  const read = rows as ChatMessageWithAuthor[];
  const page = read.slice(0, input.limit);
  return {
    access: (access as ChatAccess[])[0],
    messages: input.after ? page : page.reverse(),
    hasMore: read.length > input.limit,
  };
};
