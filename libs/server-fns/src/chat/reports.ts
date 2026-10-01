import {
  AppError,
  err,
  ok,
  type ChatReportReason,
  type Result,
} from '@founders-coffee/core';
import { reportChatMessage, type Db } from '@founders-coffee/db';

/**
 * Report a message in a meetup's chat for a moderator to review.
 *
 * Reporting the same message twice is answered as the report it already is. A report the one
 * conditional write refuses, of the reporter's own message, a removed or system one, or one in a
 * chat they do not belong to, is refused alike, without saying which.
 */
export const reportChatMessageResolver = async (
  db: Db,
  input: { messageId: string; reporterId: string; reason: ChatReportReason },
): Promise<Result<{ readonly status: 'reported' | 'already_reported' }>> => {
  const outcome = await reportChatMessage(db, input);
  if (outcome === 'refused')
    return err(
      new AppError('chat_report_refused', 'This message cannot be reported'),
    );
  return ok({ status: outcome });
};
