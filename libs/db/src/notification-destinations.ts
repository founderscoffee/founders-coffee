import { and, eq, gt, notExists, sql } from 'drizzle-orm';

import type { Db } from './db.js';
import {
  accountPreferences,
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
  readonly eventUpdates: boolean;
  readonly eventReminders: boolean;
  readonly hostUpdates: boolean;
  readonly localePref: string | null;
  readonly pushEnabled: boolean;
  readonly smsFallbackEnabled: boolean;
}

/**
 * Where a member can be reached right now, as opposed to when the message was queued.
 *
 * A scheduled notification carries the contact details that were true at the moment it was
 * written, which for an event reminder can be days earlier. Everything a delivery decision needs
 * is read here in one query, at send time, so the dispatcher never has to decide whether the row
 * it is holding still describes anybody.
 *
 * The member's own notification preferences are read here too, for the same reason the address is:
 * a category switched off or a consent withdrawn after the row was written must take effect on that
 * row, not only on rows queued afterwards. The join is a LEFT one and every column is coalesced to
 * the value the table declares as its default, so a member with no preferences row behaves exactly
 * like one holding a freshly created row — the two must not differ, because whether a row exists
 * depends only on when the account was created relative to migration 0020.
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
      localePref: user.localePref,
      eventUpdates: sql<number>`coalesce(${accountPreferences.eventUpdates}, 1)`,
      eventReminders: sql<number>`coalesce(${accountPreferences.eventReminders}, 1)`,
      hostUpdates: sql<number>`coalesce(${accountPreferences.hostUpdates}, 1)`,
      pushEnabled: sql<number>`coalesce(${accountPreferences.pushEnabled}, 0)`,
      smsFallbackEnabled: sql<number>`coalesce(${accountPreferences.smsFallbackEnabled}, 0)`,
    })
    .from(user)
    .leftJoin(accountPreferences, eq(accountPreferences.userId, user.id))
    .where(eq(user.id, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    accountState: row.accountState,
    email: row.email,
    phoneNumber: row.phoneNumber,
    phoneNumberVerified: row.phoneNumberVerified,
    localePref: row.localePref,
    eventUpdates: row.eventUpdates === 1,
    eventReminders: row.eventReminders === 1,
    hostUpdates: row.hostUpdates === 1,
    pushEnabled: row.pushEnabled === 1,
    smsFallbackEnabled: row.smsFallbackEnabled === 1,
  };
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
