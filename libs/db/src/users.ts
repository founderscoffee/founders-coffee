import { and, eq } from 'drizzle-orm';

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
  const rows = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  return rows[0];
};

/**
 * Give a user `name`, unless their name is no longer `expected`, the value it was read as. The
 * condition makes the read and the write one decision, so a name the member saves in between is
 * never overwritten. Returns whether the name was written.
 */
export const replaceUserName = async (
  db: Db,
  change: { userId: string; expected: string; name: string },
): Promise<boolean> => {
  const rows = await db
    .update(user)
    .set({ name: change.name, updatedAt: new Date() })
    .where(and(eq(user.id, change.userId), eq(user.name, change.expected)))
    .returning({ id: user.id });
  return rows.length > 0;
};
