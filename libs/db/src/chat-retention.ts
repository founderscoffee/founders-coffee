import { and, inArray, isNotNull, lt, lte } from 'drizzle-orm';

import { CHAT_REPORT_KEPT_MONTHS } from '@founders-coffee/core';

import type { Db } from './db.js';
import { chatChannels, chatReports } from './schema.js';

/**
 * The moment `months` calendar months before `date`, in UTC.
 */
const monthsBefore = (date: Date, months: number): Date => {
  const moment = new Date(date.getTime());
  moment.setUTCMonth(moment.getUTCMonth() - months);
  return moment;
};

/**
 * Up to `limit` chats whose `expires_at` has come, 90 days after their meetup ended or was
 * cancelled, read only through `chat_channels_expires_at_index`: the narrow, indexed daily sweep
 * AGENTS.md §11.5 allows for retention (#106).
 */
export const expiredChatIds = (db: Db, input: { now: Date; limit: number }) =>
  db
    .select({ id: chatChannels.id })
    .from(chatChannels)
    .where(lte(chatChannels.expiresAt, input.now))
    .limit(input.limit);

/**
 * Up to `limit` chat reports decided more than {@link CHAT_REPORT_KEPT_MONTHS} months ago, read
 * only through the partial index on `reviewed_at`.
 *
 * The privacy policy keeps a moderation report 24 months after the request closes, and a chat
 * report closes with a moderator's decision, which sets `reviewed_at`. A report still open has no
 * decision and is never among them.
 */
export const expiredChatReportIds = (
  db: Db,
  input: { now: Date; limit: number },
) =>
  db
    .select({ id: chatReports.id })
    .from(chatReports)
    .where(
      and(
        isNotNull(chatReports.reviewedAt),
        lt(
          chatReports.reviewedAt,
          monthsBefore(input.now, CHAT_REPORT_KEPT_MONTHS),
        ),
      ),
    )
    .limit(input.limit);

/**
 * Delete the chats {@link expiredChatIds} finds, as the privacy policy promises (CH-09).
 *
 * Their messages and their members' read and mute settings go with them, through the foreign keys
 * that cascade from `chat_channels`. Reports are not among them: they keep no copy of a message and
 * outlive its chat. Returns how many chats went, counted from the rows the delete returns: D1's
 * `changes` also counts every row that cascaded.
 */
export const deleteExpiredChats = async (
  db: Db,
  input: { now: Date; limit: number },
): Promise<number> => {
  const deleted = await db
    .delete(chatChannels)
    .where(inArray(chatChannels.id, expiredChatIds(db, input)))
    .returning({ id: chatChannels.id });
  return deleted.length;
};

/**
 * Delete the reports {@link expiredChatReportIds} finds. Returns how many went.
 */
export const deleteExpiredChatReports = async (
  db: Db,
  input: { now: Date; limit: number },
): Promise<number> => {
  const result = await db
    .delete(chatReports)
    .where(inArray(chatReports.id, expiredChatReportIds(db, input)));
  return (result.meta?.changes ?? 0) as number;
};
