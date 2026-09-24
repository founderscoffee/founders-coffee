import { and, eq, gt, inArray, ne, sql } from 'drizzle-orm';

import { TELEGRAM_GROUP_POST_KEYS } from '@founders-coffee/core';

import { batch } from './atomic.js';
import type { Db } from './db.js';
import { ASSUMED_DURATION_SECONDS } from './events.js';
import {
  eventTelegramGroups,
  events,
  scheduledNotifications,
  type Event,
  type EventTelegramGroupRow,
} from './schema.js';

export const TELEGRAM_GROUP_CLOSES_AFTER_SECONDS = 24 * 60 * 60;

const changesOf = (result: unknown): number =>
  (result as { meta?: { changes?: number } }).meta?.changes ?? 0;

const secondsOf = (value: Date): number => Math.floor(value.getTime() / 1000);

export const getTelegramGroup = async (
  db: Db,
  eventId: string,
): Promise<EventTelegramGroupRow | undefined> => {
  const rows = await db
    .select()
    .from(eventTelegramGroups)
    .where(eq(eventTelegramGroups.eventId, eventId))
    .limit(1);
  return rows[0];
};

/**
 * Start connecting a meetup to a Telegram group, unless it already has one.
 *
 * The row goes to `pending` with a fresh token hash whatever it held before, except `active`: a live
 * group is unhooked only by disconnecting it, never by a second tap on Connect. One statement, so
 * two taps cannot interleave a read with a write, and the later token replaces the earlier one. A
 * pending connection has no chat: the one a closed group was in is forgotten here, so only a group
 * that is running has a chat to release when it closes.
 */
export const openTelegramConnect = async (
  db: Db,
  opts: { eventId: string; tokenHash: string; expiresAt: Date; now: Date },
): Promise<boolean> => {
  const result = await db
    .insert(eventTelegramGroups)
    .values({
      eventId: opts.eventId,
      status: 'pending',
      connectTokenHash: opts.tokenHash,
      connectTokenExpiresAt: opts.expiresAt,
      createdAt: opts.now,
      updatedAt: opts.now,
    })
    .onConflictDoUpdate({
      target: eventTelegramGroups.eventId,
      set: {
        status: 'pending',
        chatId: null,
        chatTitle: null,
        pinnedMessageId: null,
        connectTokenHash: opts.tokenHash,
        connectTokenExpiresAt: opts.expiresAt,
        updatedAt: opts.now,
      },
      setWhere: ne(eventTelegramGroups.status, 'active'),
    });
  return changesOf(result) > 0;
};

/** The pending connection a `/start` token opens, with its meetup, while the token is unexpired. */
export const findTelegramConnect = async (
  db: Db,
  opts: { tokenHash: string; now: Date },
): Promise<{ group: EventTelegramGroupRow; event: Event } | undefined> => {
  const rows = await db
    .select({ group: eventTelegramGroups, event: events })
    .from(eventTelegramGroups)
    .innerJoin(events, eq(events.id, eventTelegramGroups.eventId))
    .where(
      and(
        eq(eventTelegramGroups.connectTokenHash, opts.tokenHash),
        eq(eventTelegramGroups.status, 'pending'),
        gt(eventTelegramGroups.connectTokenExpiresAt, opts.now),
      ),
    )
    .limit(1);
  return rows[0];
};

/**
 * Spend a connect token on the group it was sent in, and make that group the meetup's.
 *
 * Every condition the webhook checked is checked again inside the statement, because they can all
 * change while it talks to Telegram: the token must still be pending and unexpired, and the meetup
 * still published and not yet over. A meetup with no end is taken to last two hours, as the live
 * room takes it. Answers whether this call is the one that connected it, so a `/start` delivered
 * twice connects once.
 */
export const completeTelegramConnect = async (
  db: Db,
  opts: {
    eventId: string;
    tokenHash: string;
    chatId: number;
    chatTitle: string | null;
    now: Date;
  },
): Promise<boolean> => {
  const nowSeconds = secondsOf(opts.now);
  const result = await db
    .update(eventTelegramGroups)
    .set({
      status: 'active',
      chatId: opts.chatId,
      chatTitle: opts.chatTitle,
      pinnedMessageId: null,
      connectTokenHash: null,
      connectTokenExpiresAt: null,
      connectedAt: opts.now,
      closedAt: null,
      updatedAt: opts.now,
    })
    .where(
      and(
        eq(eventTelegramGroups.eventId, opts.eventId),
        eq(eventTelegramGroups.connectTokenHash, opts.tokenHash),
        eq(eventTelegramGroups.status, 'pending'),
        gt(eventTelegramGroups.connectTokenExpiresAt, opts.now),
        sql`EXISTS (
          SELECT 1 FROM events
          WHERE events.id = ${opts.eventId}
            AND events.status = 'published'
            AND COALESCE(events.ends_at, events.starts_at + ${ASSUMED_DURATION_SECONDS}) > ${nowSeconds}
        )`,
      ),
    );
  return changesOf(result) > 0;
};

export const setTelegramPinnedMessage = async (
  db: Db,
  opts: { eventId: string; messageId: number; now: Date },
): Promise<void> => {
  await db
    .update(eventTelegramGroups)
    .set({ pinnedMessageId: opts.messageId, updatedAt: opts.now })
    .where(eq(eventTelegramGroups.eventId, opts.eventId));
};

/**
 * End the bot's work for one meetup's group, and answer what this call closed.
 *
 * A running group answers the chat it ran in, for the caller to release. A pending connection
 * closes too, and loses its token, so disconnecting also withdraws a Connect link the host has not
 * used yet; it has no chat to answer. `undefined` means there was nothing left to close, so of two
 * calls racing each other only one is told about the chat.
 */
export const closeTelegramGroup = async (
  db: Db,
  opts: { eventId: string; now: Date },
): Promise<{ chatId: number | null } | undefined> => {
  const rows = await db
    .update(eventTelegramGroups)
    .set({
      status: 'closed',
      connectTokenHash: null,
      connectTokenExpiresAt: null,
      closedAt: opts.now,
      updatedAt: opts.now,
    })
    .where(
      and(
        eq(eventTelegramGroups.eventId, opts.eventId),
        ne(eventTelegramGroups.status, 'closed'),
      ),
    )
    .returning({ chatId: eventTelegramGroups.chatId });
  return rows[0];
};

/**
 * Close every meetup still using a chat the bot has been removed from, and name them.
 *
 * The posts the bot had queued for those meetups are withdrawn in the same batch, since none of them
 * can reach the chat any more; they go first, while the groups still say which meetups were live
 * there. A removal or a departure names its own chat, and settles a chat that is gone by itself.
 */
export const closeTelegramGroupsForChat = async (
  db: Db,
  opts: { chatId: number; now: Date },
): Promise<string[]> => {
  const liveOnChat = and(
    eq(eventTelegramGroups.chatId, opts.chatId),
    eq(eventTelegramGroups.status, 'active'),
  );
  const [, closed] = await batch(db, [
    db
      .update(scheduledNotifications)
      .set({ status: 'cancelled', updatedAt: opts.now })
      .where(
        and(
          eq(scheduledNotifications.status, 'pending'),
          inArray(scheduledNotifications.templateKey, [
            ...TELEGRAM_GROUP_POST_KEYS,
          ]),
          inArray(
            scheduledNotifications.eventId,
            db
              .select({ eventId: eventTelegramGroups.eventId })
              .from(eventTelegramGroups)
              .where(liveOnChat),
          ),
        ),
      ),
    db
      .update(eventTelegramGroups)
      .set({ status: 'closed', closedAt: opts.now, updatedAt: opts.now })
      .where(liveOnChat)
      .returning({ eventId: eventTelegramGroups.eventId }),
  ]);
  return (closed as { eventId: string }[]).map((row) => row.eventId);
};

/**
 * Follow a group Telegram has upgraded to a supergroup, which gives it a new chat id.
 *
 * Every row that pointed at the old id moves, closed ones included, so a later meetup the host
 * connects finds the group under the id it now has. The pinned message is forgotten, because message
 * ids do not survive the upgrade, and the next change to the details posts and pins them afresh.
 */
export const moveTelegramChat = async (
  db: Db,
  opts: { fromChatId: number; toChatId: number; now: Date },
): Promise<number> => {
  const result = await db
    .update(eventTelegramGroups)
    .set({
      chatId: opts.toChatId,
      pinnedMessageId: null,
      updatedAt: opts.now,
    })
    .where(eq(eventTelegramGroups.chatId, opts.fromChatId));
  return changesOf(result);
};

/** Whether any meetup still has this chat as its live group, so the bot must stay in it. */
export const isTelegramChatInUse = async (
  db: Db,
  chatId: number,
): Promise<boolean> => {
  const rows = await db
    .select({ eventId: eventTelegramGroups.eventId })
    .from(eventTelegramGroups)
    .where(
      and(
        eq(eventTelegramGroups.chatId, chatId),
        eq(eventTelegramGroups.status, 'active'),
      ),
    )
    .limit(1);
  return rows.length > 0;
};
