import { and, eq, sql, type SQL } from 'drizzle-orm';

import { chatNowMs } from './chat-channels.js';
import { isChatMember } from './chat-membership.js';
import type { Db } from './db.js';
import {
  chatChannels,
  chatMembers,
  events,
  type ChatMemberRow,
} from './schema.js';

/**
 * Write a member's own state for the chat of `eventId`, if they are a member of it.
 *
 * One upsert: the row comes from the chat and its meetup, so a reader who is not a member writes
 * nothing, and `onConflict` says how an existing row changes. The answer is whether a row was
 * written.
 */
const upsertMemberState = async (
  db: Db,
  input: { readonly eventId: string; readonly userId: string },
  values: { readonly lastReadAt: SQL; readonly muted: SQL },
  onConflict: { readonly lastReadAt?: SQL; readonly muted?: SQL },
): Promise<boolean> => {
  const result = await db
    .insert(chatMembers)
    .select(
      db
        .select({
          channelId: chatChannels.id,
          userId: sql<string>`${input.userId}`.as('user_id'),
          lastReadAt: values.lastReadAt.as('last_read_at'),
          muted: values.muted.as('muted'),
          updatedAt: sql`unixepoch()`.as('updated_at'),
        })
        .from(chatChannels)
        .innerJoin(events, eq(events.id, chatChannels.eventId))
        .where(
          and(
            eq(chatChannels.eventId, input.eventId),
            isChatMember(input.userId),
          ),
        ),
    )
    .onConflictDoUpdate({
      target: [chatMembers.channelId, chatMembers.userId],
      set: { ...onConflict, updatedAt: sql`unixepoch()` },
    })
    .run();
  return (result.meta?.changes ?? 0) > 0;
};

/**
 * Record that a member has read the chat of `eventId` up to `at`, in milliseconds.
 *
 * The marker only moves forward, so an older tab reporting late cannot mark messages unread again,
 * and never past the database's own clock, so a device with a clock ahead cannot mark tomorrow's
 * messages read today.
 */
export const markChatRead = (
  db: Db,
  input: {
    readonly eventId: string;
    readonly userId: string;
    readonly at: number;
  },
): Promise<boolean> =>
  upsertMemberState(
    db,
    input,
    { lastReadAt: sql`min(${input.at}, ${chatNowMs()})`, muted: sql`0` },
    {
      lastReadAt: sql`max(coalesce(${chatMembers.lastReadAt}, 0), excluded.last_read_at)`,
    },
  );

/** Mute or unmute the chat of `eventId` for one of its members. */
export const setChatMuted = (
  db: Db,
  input: {
    readonly eventId: string;
    readonly userId: string;
    readonly muted: boolean;
  },
): Promise<boolean> =>
  upsertMemberState(
    db,
    input,
    { lastReadAt: sql`null`, muted: sql`${input.muted ? 1 : 0}` },
    { muted: sql`excluded.muted` },
  );

/** A member's own state for a chat, if they have read it or muted it. */
export const getChatMemberState = async (
  db: Db,
  input: { readonly channelId: string; readonly userId: string },
): Promise<ChatMemberRow | undefined> => {
  const rows = await db
    .select()
    .from(chatMembers)
    .where(
      and(
        eq(chatMembers.channelId, input.channelId),
        eq(chatMembers.userId, input.userId),
      ),
    )
    .limit(1);
  return rows[0];
};
