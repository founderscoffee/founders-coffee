import { and, eq, or, sql, type SQL } from 'drizzle-orm';

import {
  CHAT_KEPT_DAYS_AFTER_MEETUP,
  CHAT_OPEN_DAYS_AFTER_MEETUP,
} from '@founders-coffee/core';

import type { Db } from './db.js';
import { eventEndsAt } from './events-end.js';
import { chatChannels, events, type ChatChannelRow } from './schema.js';

const DAY_SECONDS = 24 * 60 * 60;

export const CHAT_OPEN_AFTER_MEETUP_SECONDS =
  CHAT_OPEN_DAYS_AFTER_MEETUP * DAY_SECONDS;
export const CHAT_KEPT_AFTER_MEETUP_SECONDS =
  CHAT_KEPT_DAYS_AFTER_MEETUP * DAY_SECONDS;

/**
 * The database's clock in epoch milliseconds, for the chat's timestamps.
 *
 * `unixepoch()` counts whole seconds, and several messages land in one second. The Julian day
 * carries the milliseconds, and 2440587.5 is the Julian day of the epoch; this spelling works on
 * any SQLite, where `unixepoch('subsec')` needs 3.42. The day is a floating-point fraction, so the
 * product is rounded to the millisecond it stands for rather than cut short of it.
 */
export const chatNowMs = (): SQL =>
  sql`cast(round((julianday('now') - 2440587.5) * 86400000) as integer)`;

/**
 * When the meetup in the statement's `events` row is over for its chat, in epoch seconds: the
 * moment it was cancelled, or when it ends.
 *
 * A cancellation older than `cancelled_at` has no time of its own, so it falls back to the row's
 * last change, which is the cancellation for any meetup cancelled since.
 */
const meetupOverAt = (): SQL =>
  sql`(case when ${events.status} = 'cancelled' then coalesce(${events.cancelledAt}, ${events.updatedAt}) else ${eventEndsAt()} end)`;

/**
 * When the chat of the meetup in the statement's `events` row stops taking messages: at its
 * cancellation, or {@link CHAT_OPEN_AFTER_MEETUP_SECONDS} after it ends.
 *
 * This and {@link chatExpiresAt} are the one derivation of a chat's lifetime. Every write that can
 * move a meetup's end or status runs them in its own batch, and migration 0041 spells the same
 * expression out in SQL for its backfill, which its test holds equal to this one.
 */
export const chatReadOnlyAt = (): SQL =>
  sql`(${meetupOverAt()} + (case when ${events.status} = 'cancelled' then 0 else ${CHAT_OPEN_AFTER_MEETUP_SECONDS} end))`;

/** When the chat of the meetup in the statement's `events` row is deleted with its messages. */
export const chatExpiresAt = (): SQL =>
  sql`(${meetupOverAt()} + ${CHAT_KEPT_AFTER_MEETUP_SECONDS})`;

/**
 * Write the chat of the meetup `eventId`, taking its market and lifetime from the meetup's own row.
 *
 * It selects from `events`, so it writes nothing when the meetup is not there: a meetup whose
 * address was taken was never written, and its chat is not either, in the same batch. It writes
 * nothing for a meetup whose chat has already expired, and nothing when the chat exists, so the
 * same statement heals a meetup a Worker older than 0041 published, from its first message.
 */
export const insertChatChannel = (
  db: Db,
  input: { readonly id: string; readonly eventId: string },
) =>
  db
    .insert(chatChannels)
    .select(
      db
        .select({
          id: sql<string>`${input.id}`.as('id'),
          kind: sql<'meetup'>`'meetup'`.as('kind'),
          eventId: events.id,
          marketCode: events.marketCode,
          readOnlyAt: chatReadOnlyAt().as('read_only_at'),
          expiresAt: chatExpiresAt().as('expires_at'),
          createdAt: sql`unixepoch()`.as('created_at'),
          updatedAt: sql`unixepoch()`.as('updated_at'),
        })
        .from(events)
        .where(
          and(
            eq(events.id, input.eventId),
            sql`${chatExpiresAt()} > unixepoch()`,
          ),
        ),
    )
    .onConflictDoNothing({ target: chatChannels.eventId });

/** One lifetime expression read from the meetup of the chat row being updated. */
const fromMeetup = (lifetime: SQL): SQL =>
  sql`(select ${lifetime} from ${events} where ${events.id} = ${chatChannels.eventId})`;

/**
 * Bring the chat of the meetup `eventId` in line with the meetup's row as it stands.
 *
 * It runs after the meetup's own write in one batch and derives from the row rather than from what
 * the write meant to set, so a write that lost a version race or found the wrong status, and
 * changed nothing, changes nothing here either: the lifetime already matches the row.
 */
export const syncChatChannel = (db: Db, eventId: string) =>
  db
    .update(chatChannels)
    .set({
      readOnlyAt: fromMeetup(chatReadOnlyAt()),
      expiresAt: fromMeetup(chatExpiresAt()),
      updatedAt: sql`unixepoch()`,
    })
    .where(
      and(
        eq(chatChannels.eventId, eventId),
        or(
          sql`${chatChannels.readOnlyAt} is not ${fromMeetup(chatReadOnlyAt())}`,
          sql`${chatChannels.expiresAt} is not ${fromMeetup(chatExpiresAt())}`,
        ),
      ),
    );

/** The chat of the meetup `eventId`, if it has one. */
export const getChatChannel = async (
  db: Db,
  eventId: string,
): Promise<ChatChannelRow | undefined> => {
  const rows = await db
    .select()
    .from(chatChannels)
    .where(eq(chatChannels.eventId, eventId))
    .limit(1);
  return rows[0];
};
