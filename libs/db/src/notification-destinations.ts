import { and, eq, gt, notExists, sql } from 'drizzle-orm';

import type { Db } from './db.js';
import {
  pushSessionLinks,
  pushSubscriptions,
  session,
  user,
} from './schema.js';

export interface NotificationContact {
  readonly accountState: string;
  readonly email: string;
  readonly phoneNumber: string | null;
  readonly phoneNumberVerified: boolean;
}

/**
 * Where a member can be reached right now, as opposed to when the message was queued.
 *
 * A scheduled notification carries the contact details that were true at the moment it was
 * written, which for an event reminder can be days earlier. Everything a delivery decision needs
 * is read here in one query, at send time, so the dispatcher never has to decide whether the row
 * it is holding still describes anybody.
 *
 * The ban columns are deliberately absent. Whether a suppressed member still receives their own
 * reminders is a moderation decision that belongs to CO-09, and reading `banned` here would settle
 * it silently as a side effect of a delivery guard nobody reviewed for that.
 */
export const getNotificationContact = async (
  db: Db,
  userId: string,
): Promise<NotificationContact | null> => {
  const rows = await db
    .select({
      accountState: user.accountState,
      email: user.email,
      phoneNumber: user.phoneNumber,
      phoneNumberVerified: user.phoneNumberVerified,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return rows[0] ?? null;
};

/**
 * The device tokens still entitled to receive a push for this member.
 *
 * A subscription associated with a session is only deliverable while that session lives, which is
 * what makes signing a device out actually stop the notifications reaching it. A subscription with
 * no association at all is still deliverable: those predate the association and enforcing the rule
 * against them would silently end push for every device registered before it existed. Migrating
 * or withdrawing them is PF-07/PF-08's work, and until it happens the absence of a link is missing
 * information rather than a revoked one.
 */
export const listDeliverablePushTokens = async (
  db: Db,
  userId: string,
): Promise<string[]> => {
  const liveSession = db
    .select({ id: session.id })
    .from(session)
    .where(
      and(
        eq(session.id, pushSessionLinks.sessionId),
        gt(session.expiresAt, sql`unixepoch()`),
      ),
    );
  const revokedLink = db
    .select({ subscriptionId: pushSessionLinks.subscriptionId })
    .from(pushSessionLinks)
    .where(
      and(
        eq(pushSessionLinks.subscriptionId, pushSubscriptions.id),
        notExists(liveSession),
      ),
    );

  const rows = await db
    .select({ token: pushSubscriptions.token })
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), notExists(revokedLink)));
  return rows.map((row) => row.token);
};

/** Whether the account is in a state that may still be sent to at all. */
export const isDeliverableAccountState = (state: string): boolean =>
  state === 'active';
