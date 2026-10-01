import { and, eq, sql } from 'drizzle-orm';

import { id, type ChatSystemKey } from '@founders-coffee/core';

import { batch } from './atomic.js';
import { chatNowMs, insertChatChannel } from './chat-channels.js';
import { isChatSwitchedOn } from './chat-membership.js';
import {
  messagesWithAuthors,
  type ChatMessageWithAuthor,
} from './chat-reads.js';
import type { Db } from './db.js';
import { chatChannels, chatMessages, events } from './schema.js';

/**
 * Tell the chat of `eventId` what just happened to its meetup, as a system message: a key and its
 * parameters, which each member's screen reads in their own language.
 *
 * One batch, so one trip to D1. The chat's insert comes first and heals a meetup that has none, as a
 * member's first message does. The notice is written whether or not the chat still takes members'
 * messages, since a cancellation turns it read-only in the write before this one and is the notice
 * most worth reading, but only where the meetup's market has switched its chats on, by the flag
 * every read and write keeps. It is read back by its id for the room to push, and nothing comes
 * back when nothing was written.
 */
export const postChatSystemMessage = async (
  db: Db,
  input: {
    readonly eventId: string;
    readonly systemKey: ChatSystemKey;
    readonly systemParams: Readonly<Record<string, string>>;
  },
): Promise<ChatMessageWithAuthor | undefined> => {
  const messageId = id('msg');
  const [, , stored] = await batch(db, [
    insertChatChannel(db, { id: id('chn'), eventId: input.eventId }),
    db.insert(chatMessages).select(
      db
        .select({
          id: sql<string>`${messageId}`.as('id'),
          channelId: chatChannels.id,
          authorId: sql<null>`null`.as('author_id'),
          kind: sql<'system'>`'system'`.as('kind'),
          body: sql<string>`''`.as('body'),
          systemKey: sql<string>`${input.systemKey}`.as('system_key'),
          systemParams: sql<string>`${JSON.stringify(input.systemParams)}`.as(
            'system_params',
          ),
          clientId: sql<null>`null`.as('client_id'),
          createdAt: chatNowMs().as('created_at'),
          removedAt: sql<null>`null`.as('removed_at'),
          removedBy: sql<null>`null`.as('removed_by'),
          removal: sql<null>`null`.as('removal'),
        })
        .from(chatChannels)
        .innerJoin(events, eq(events.id, chatChannels.eventId))
        .where(
          and(eq(chatChannels.eventId, input.eventId), isChatSwitchedOn()),
        ),
    ),
    messagesWithAuthors(db).where(eq(chatMessages.id, messageId)).limit(1),
  ]);
  return (stored as ChatMessageWithAuthor[])[0];
};
