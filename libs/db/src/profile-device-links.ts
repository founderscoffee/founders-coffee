import { sql } from 'drizzle-orm';

import type { Db } from './db.js';
import { activeProfileIdentity } from './profile-access.js';
import {
  pushSessionLinks,
  pushSubscriptions,
  session,
  user,
} from './schema.js';

/** Associate delivery with a live session only when both records belong to the authenticated owner. */
export const linkPushSubscriptionToSession = async (
  db: Db,
  input: { userId: string; subscriptionId: string; sessionId: string },
): Promise<boolean> => {
  const result =
    await db.run(sql`INSERT INTO ${pushSessionLinks} (subscription_id, session_id, user_id)
    SELECT ${pushSubscriptions.id}, ${session.id}, ${pushSubscriptions.userId}
    FROM ${pushSubscriptions}
    INNER JOIN ${session} ON ${session.userId} = ${pushSubscriptions.userId}
    INNER JOIN ${user} ON ${user.id} = ${pushSubscriptions.userId}
    WHERE ${activeProfileIdentity(input.userId)}
      AND ${pushSubscriptions.id} = ${input.subscriptionId}
      AND ${session.id} = ${input.sessionId} AND ${session.expiresAt} > unixepoch()
    ON CONFLICT (subscription_id) DO UPDATE SET session_id = excluded.session_id,
      created_at = unixepoch() WHERE user_id = excluded.user_id`);
  return result.meta.changes === 1;
};
