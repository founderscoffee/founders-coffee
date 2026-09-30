import {
  deleteExpiredChatReports,
  deleteExpiredChats,
  type Db,
} from '@founders-coffee/db';
import { logger } from '@founders-coffee/observability';

import { deleteInPasses } from './retention.js';

/**
 * The meetup chat's part of the daily retention sweep (CH-09): the chats 90 days past their
 * meetup, with their messages and settings, then the reports decided more than 24 months ago,
 * as the privacy policy promises.
 */
export const sweepChatRetention = async (
  db: Db,
): Promise<{ chats: number; reports: number }> => {
  const now = new Date();
  const chats = await deleteInPasses((limit) =>
    deleteExpiredChats(db, { now, limit }),
  );
  const reports = await deleteInPasses((limit) =>
    deleteExpiredChatReports(db, { now, limit }),
  );
  if (chats > 0 || reports > 0)
    logger.info('chat.retention_sweep', { chats, reports });
  return { chats, reports };
};
