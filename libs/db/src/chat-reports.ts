import { and, eq, isNull, ne, sql } from 'drizzle-orm';

import {
  id,
  type ChatReportOutcome,
  type ChatReportReason,
} from '@founders-coffee/core';

import { batch } from './atomic.js';
import { isChatMember } from './chat-membership.js';
import type { Db } from './db.js';
import { chatChannels, chatMessages, chatReports, events } from './schema.js';

/**
 * Report a message in a meetup's chat for a moderator to review.
 *
 * One batch. The report's insert selects from the message, its chat and its meetup, so it writes
 * only for a text message still standing, written by someone else, in a chat the reporter belongs
 * to, and it takes the chat's market for the review queue and the message's author, who the report
 * is about. A second report of the same message by the same member writes nothing and answers
 * `already_reported`, read back in the same batch.
 */
export const reportChatMessage = async (
  db: Db,
  input: {
    readonly messageId: string;
    readonly reporterId: string;
    readonly reason: ChatReportReason;
  },
): Promise<ChatReportOutcome> => {
  const [written, existing] = await batch(db, [
    db
      .insert(chatReports)
      .select(
        db
          .select({
            id: sql<string>`${id('rpt')}`.as('id'),
            messageId: chatMessages.id,
            reporterId: sql<string>`${input.reporterId}`.as('reporter_id'),
            reportedUserId: chatMessages.authorId,
            marketCode: chatChannels.marketCode,
            reason: sql<ChatReportReason>`${input.reason}`.as('reason'),
            status: sql<'open'>`'open'`.as('status'),
            reviewedBy: sql<null>`null`.as('reviewed_by'),
            reviewedAt: sql<null>`null`.as('reviewed_at'),
            createdAt: sql`unixepoch()`.as('created_at'),
          })
          .from(chatMessages)
          .innerJoin(chatChannels, eq(chatChannels.id, chatMessages.channelId))
          .innerJoin(events, eq(events.id, chatChannels.eventId))
          .where(
            and(
              eq(chatMessages.id, input.messageId),
              eq(chatMessages.kind, 'text'),
              isNull(chatMessages.removedAt),
              ne(chatMessages.authorId, input.reporterId),
              isChatMember(input.reporterId),
            ),
          ),
      )
      .onConflictDoNothing({
        target: [chatReports.messageId, chatReports.reporterId],
      }),
    db
      .select({ id: chatReports.id })
      .from(chatReports)
      .where(
        and(
          eq(chatReports.messageId, input.messageId),
          eq(chatReports.reporterId, input.reporterId),
        ),
      )
      .limit(1),
  ]);
  if (((written as { meta?: { changes?: number } }).meta?.changes ?? 0) > 0) {
    return 'reported';
  }
  return (existing as { id: string }[]).length > 0
    ? 'already_reported'
    : 'refused';
};
