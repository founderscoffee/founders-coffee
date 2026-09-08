import { and, eq, isNull, or } from 'drizzle-orm';

import { user } from './schema.js';

/** Restrict profile writes and reads to a live, unrestricted identity. */
export const activeProfileIdentity = (userId: string) =>
  and(
    eq(user.id, userId),
    eq(user.accountState, 'active'),
    or(eq(user.banned, false), isNull(user.banned)),
  );
