import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm';

import type { Db } from './db.js';
import {
  account,
  pushSessionLinks,
  pushSubscriptions,
  session,
} from './schema.js';

export interface OwnedSession {
  readonly id: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly userAgent: string | null;
}

/** The member's own live sessions, newest first, without the token that would let one be replayed. */
export const listOwnedSessions = async (
  db: Db,
  userId: string,
): Promise<OwnedSession[]> =>
  db
    .select({
      id: session.id,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      userAgent: session.userAgent,
    })
    .from(session)
    .where(
      and(eq(session.userId, userId), gt(session.expiresAt, sql`unixepoch()`)),
    )
    .orderBy(desc(session.createdAt));

/** Which of the member's own sessions this token belongs to, or nothing. */
export const findOwnedSessionByToken = async (
  db: Db,
  userId: string,
  token: string,
): Promise<string | null> => {
  const rows = await db
    .select({ id: session.id })
    .from(session)
    .where(and(eq(session.userId, userId), eq(session.token, token)))
    .limit(1);
  return rows[0]?.id ?? null;
};

/**
 * End sessions the member owns, and take their devices' push registrations with them.
 *
 * Deleting the session alone would do the opposite of what a member means by signing a device out.
 * `push_session_links` cascades off the session row, so the association disappears — and an
 * unassociated subscription is treated as a legacy registration and therefore *deliverable*, which
 * would turn a revocation into a permission to keep notifying the device it revoked. The
 * subscriptions go first, while the link still names them.
 *
 * Ownership is part of every statement rather than checked before them: a caller who names a
 * session belonging to someone else deletes nothing, whatever it passed.
 */
export const revokeOwnedSessions = async (
  db: Db,
  userId: string,
  sessionIds: readonly string[],
): Promise<number> => {
  if (sessionIds.length === 0) return 0;
  const owned = await db
    .select({ id: session.id })
    .from(session)
    .where(
      and(eq(session.userId, userId), inArray(session.id, [...sessionIds])),
    );
  const ids = owned.map((row) => row.id);
  if (ids.length === 0) return 0;

  const links = await db
    .select({ subscriptionId: pushSessionLinks.subscriptionId })
    .from(pushSessionLinks)
    .where(
      and(
        eq(pushSessionLinks.userId, userId),
        inArray(pushSessionLinks.sessionId, ids),
      ),
    );
  const subscriptionIds = links.map((row) => row.subscriptionId);

  if (subscriptionIds.length > 0)
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          inArray(pushSubscriptions.id, subscriptionIds),
        ),
      );

  await db
    .delete(session)
    .where(and(eq(session.userId, userId), inArray(session.id, ids)));
  return ids.length;
};

/**
 * Unlink a provider only while another way in survives, decided in the statement.
 *
 * The count and the delete are one conditional statement rather than a read followed by a write,
 * so two requests unlinking the last two providers at the same moment cannot both observe a spare
 * and both proceed. Returns whether a row was removed; `false` means the caller was refused.
 */
export const unlinkProviderIfNotLast = async (
  db: Db,
  input: { userId: string; providerId: string; otherMethods: number },
): Promise<boolean> => {
  const result = await db.run(sql`DELETE FROM ${account}
    WHERE ${account.userId} = ${input.userId}
      AND ${account.providerId} = ${input.providerId}
      AND ${input.otherMethods} + (
        SELECT count(*) FROM ${account} AS remaining
        WHERE remaining.user_id = ${input.userId}
          AND remaining.provider_id <> ${input.providerId}
      ) > 0`);
  return (result.meta.changes ?? 0) > 0;
};
