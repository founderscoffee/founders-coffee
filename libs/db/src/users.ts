import { eq } from 'drizzle-orm';

import type { Db } from './db.js';
import { user, type User } from './schema.js';

/**
 * Get a user by id. Returns `undefined` if not found.
 * Used by server-fns to fetch user data for notification payloads.
 */
export const getUser = async (
  db: Db,
  userId: string,
): Promise<User | undefined> => {
  const rows = await db
    .select()
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return rows[0];
};
