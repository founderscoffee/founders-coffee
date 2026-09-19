import { and, eq, gt, sql } from 'drizzle-orm';

import type { Locale } from '@founders-coffee/core';

import { account, session, user } from './schema.js';
import type { Db } from './db.js';
import { activeProfileIdentity } from './profile-access.js';

export interface AccountSummaryRow {
  readonly locale: Locale | null;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly phoneNumber: string | null;
  readonly phoneNumberVerified: boolean;
  readonly providerIds: readonly string[];
  readonly sessionCount: number;
}

/**
 * Everything the account screen states about an account, and nothing it does not.
 *
 * The three reads are separate queries rather than one join because a member with four providers
 * and three sessions would otherwise come back as twelve rows to be de-duplicated in code — and
 * the counting is the part that has to be right, since the number of signed-in devices is exactly
 * what someone opens this screen to check.
 *
 * `account.access_token`, `refresh_token`, `id_token` and `password` are never selected. They are
 * columns on the same row as the provider id, so a `select()` here would put a live OAuth token one
 * projection mistake away from a response — the column list is the guard, and it is the reason this
 * function exists rather than callers reading the table directly.
 */
export const getAccountSummary = async (
  db: Db,
  userId: string,
): Promise<AccountSummaryRow | null> => {
  const identity = await db
    .select({
      locale: user.localePref,
      email: user.email,
      emailVerified: user.emailVerified,
      phoneNumber: user.phoneNumber,
      phoneNumberVerified: user.phoneNumberVerified,
    })
    .from(user)
    .where(activeProfileIdentity(userId))
    .limit(1);
  if (identity.length === 0) return null;

  const [providers, sessions] = await Promise.all([
    db
      .selectDistinct({ providerId: account.providerId })
      .from(account)
      .where(eq(account.userId, userId)),
    db
      .select({ total: sql<number>`count(*)` })
      .from(session)
      .where(
        and(
          eq(session.userId, userId),
          gt(session.expiresAt, sql`unixepoch()`),
        ),
      ),
  ]);

  return {
    ...identity[0],
    providerIds: providers.map((row) => row.providerId),
    sessionCount: Number(sessions[0]?.total ?? 0),
  };
};

export const updateAccountLocale = async (
  db: Db,
  userId: string,
  locale: Locale,
): Promise<Locale | null> => {
  const rows = await db
    .update(user)
    .set({ localePref: locale, updatedAt: new Date() })
    .where(activeProfileIdentity(userId))
    .returning({ locale: user.localePref });
  return rows[0]?.locale ?? null;
};
