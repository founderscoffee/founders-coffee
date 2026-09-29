import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from 'drizzle-orm';

import { id, type ChatSendOutcome } from '@founders-coffee/core';

import { batch } from './atomic.js';
import { chatNowMs, insertChatChannel } from './chat-channels.js';
import { isChatMember } from './chat-membership.js';
import type { Db } from './db.js';
import {
  chatChannels,
  chatMessages,
  events,
  type ChatMessageRow,
} from './schema.js';

export type SendChatMessageResult =
  | {
      readonly outcome: Extract<ChatSendOutcome, 'sent' | 'already_sent'>;
      readonly message: ChatMessageRow;
    }
  | {
      readonly outcome: Exclude<ChatSendOutcome, 'sent' | 'already_sent'>;
    };

export type ChatMessageCursor = { readonly at: number; readonly id: string };

type SendFacts = { hasChat: number; isMember: number; isOpen: number };

/**
 * Post a text message to the chat of `eventId` as `authorId`, once however often it is retried.
 *
 * One batch, so one trip to D1. The chat's insert comes first and heals a meetup that has none.
 * The message's insert selects from the chat and its meetup, so it writes only while the chat is
 * open and the author is a member, both judged by the database in the same statement; a
 * `client_id` the author already used in this chat writes nothing. The message is then read back by
 * that id in this chat, which answers a retry with the message its first attempt stored, and the
 * facts that explain a refusal are read last. `created_at` is the database's clock in milliseconds, so every sender's
 * message takes its place on one timeline.
 */
export const sendChatMessage = async (
  db: Db,
  input: {
    readonly eventId: string;
    readonly authorId: string;
    readonly body: string;
    readonly clientId: string;
  },
): Promise<SendChatMessageResult> => {
  const [, written, stored, access] = await batch(db, [
    insertChatChannel(db, { id: id('chn'), eventId: input.eventId }),
    db
      .insert(chatMessages)
      .select(
        db
          .select({
            id: sql<string>`${id('msg')}`.as('id'),
            channelId: chatChannels.id,
            authorId: sql<string>`${input.authorId}`.as('author_id'),
            kind: sql<'text'>`'text'`.as('kind'),
            body: sql<string>`${input.body}`.as('body'),
            systemKey: sql<null>`null`.as('system_key'),
            systemParams: sql<null>`null`.as('system_params'),
            clientId: sql<string>`${input.clientId}`.as('client_id'),
            createdAt: chatNowMs().as('created_at'),
            removedAt: sql<null>`null`.as('removed_at'),
            removedBy: sql<null>`null`.as('removed_by'),
            removal: sql<null>`null`.as('removal'),
          })
          .from(chatChannels)
          .innerJoin(events, eq(events.id, chatChannels.eventId))
          .where(
            and(
              eq(chatChannels.eventId, input.eventId),
              sql`${chatChannels.readOnlyAt} > unixepoch()`,
              isChatMember(input.authorId),
            ),
          ),
      )
      .onConflictDoNothing({
        target: [
          chatMessages.channelId,
          chatMessages.authorId,
          chatMessages.clientId,
        ],
      }),
    db
      .select()
      .from(chatMessages)
      .where(
        and(
          inArray(
            chatMessages.channelId,
            db
              .select({ id: chatChannels.id })
              .from(chatChannels)
              .where(eq(chatChannels.eventId, input.eventId)),
          ),
          eq(chatMessages.authorId, input.authorId),
          eq(chatMessages.clientId, input.clientId),
        ),
      )
      .limit(1),
    db
      .select({
        hasChat: sql<number>`${chatChannels.id} is not null`,
        isMember: sql<number>`${isChatMember(input.authorId)}`,
        isOpen: sql<number>`coalesce(${chatChannels.readOnlyAt} > unixepoch(), 0)`,
      })
      .from(events)
      .leftJoin(chatChannels, eq(chatChannels.eventId, events.id))
      .where(eq(events.id, input.eventId))
      .limit(1),
  ]);
  const inserted =
    ((written as { meta?: { changes?: number } }).meta?.changes ?? 0) > 0;
  const message = (stored as ChatMessageRow[])[0];
  if (message) {
    return { outcome: inserted ? 'sent' : 'already_sent', message };
  }
  const facts = (access as SendFacts[])[0];
  if (!facts?.hasChat) return { outcome: 'chat_missing' };
  if (!facts.isMember) return { outcome: 'not_member' };
  if (!facts.isOpen) return { outcome: 'read_only' };
  throw new Error(
    `A member's message to the open chat of ${input.eventId} was not written`,
  );
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

/**
 * One page of a chat's messages, oldest first, on the `(created_at, id)` cursor its index carries.
 *
 * With no cursor it is the latest page, which is what a chat opens on. `before` pages back into the
 * history, and `after` fills the gap a reconnect left, reading forward from the newest message the
 * reader holds. Removed messages are in the page as the tombstones they are.
 */
export const listChatMessages = async (
  db: Db,
  input: {
    readonly channelId: string;
    readonly before?: ChatMessageCursor;
    readonly after?: ChatMessageCursor;
    readonly limit: number;
  },
): Promise<ChatMessageRow[]> => {
  const inChat = eq(chatMessages.channelId, input.channelId);
  if (input.after) {
    return db
      .select()
      .from(chatMessages)
      .where(and(inChat, pastCursor(input.after, 'after')))
      .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id))
      .limit(input.limit);
  }
  const newestFirst = await db
    .select()
    .from(chatMessages)
    .where(
      and(
        inChat,
        input.before ? pastCursor(input.before, 'before') : undefined,
      ),
    )
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(input.limit);
  return newestFirst.reverse();
};

/**
 * Remove a text message on behalf of `actorId`: its author, or the host of its meetup.
 *
 * One conditional update. The actor has to be a member of the message's chat, by the rule every
 * other read and write keeps, and either its author or the meetup's host; the role is recorded as
 * `author` when the actor wrote it, host included, and `host` otherwise. The body is emptied and the
 * tombstone stays. A system message, a message already removed or one the actor may not touch is
 * left alone, and the answer is `undefined`. A moderator's removal is its own write, with its
 * permission and its audit, not this one.
 */
export const removeChatMessage = async (
  db: Db,
  input: { readonly messageId: string; readonly actorId: string },
): Promise<ChatMessageRow | undefined> => {
  const rows = await db
    .update(chatMessages)
    .set({
      body: '',
      removedAt: sql`${chatNowMs()}`,
      removedBy: input.actorId,
      removal: sql`case when ${chatMessages.authorId} = ${input.actorId} then 'author' else 'host' end`,
    })
    .where(
      and(
        eq(chatMessages.id, input.messageId),
        eq(chatMessages.kind, 'text'),
        isNull(chatMessages.removedAt),
        sql`exists (
          select 1 from ${chatChannels}
            inner join ${events} on ${events.id} = ${chatChannels.eventId}
          where ${chatChannels.id} = ${chatMessages.channelId}
            and ${isChatMember(input.actorId)}
            and (${chatMessages.authorId} = ${input.actorId}
              or ${events.hostId} = ${input.actorId})
        )`,
      ),
    )
    .returning();
  return rows[0];
};
