import { and, eq } from 'drizzle-orm';

import type { Db } from './db.js';
import { pushSubscriptions, type PushSubscriptionRow } from './schema.js';

/**
 * Register a push subscription. Upserts on token (unique) — if the token
 * already exists, updates the user_id and market_code. Called on app install
 * / login / RSVP (the "hook" moment for push permission).
 */
export const registerPushToken = async (
  db: Db,
  opts: {
    id: string;
    userId: string;
    token: string;
    platform: 'ios' | 'android' | 'web';
    surface: 'pwa' | 'rn';
    marketCode: string;
  },
): Promise<PushSubscriptionRow> => {
  const existing = await db
    .select({ id: pushSubscriptions.id, userId: pushSubscriptions.userId })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.token, opts.token))
    .limit(1);

  if (existing.length > 0) {
    if (existing[0].userId === opts.userId) {
      await db
        .update(pushSubscriptions)
        .set({ marketCode: opts.marketCode, updatedAt: new Date() })
        .where(eq(pushSubscriptions.id, existing[0].id));
      return {
        id: existing[0].id,
        userId: opts.userId,
        token: opts.token,
        platform: opts.platform,
        surface: opts.surface,
        marketCode: opts.marketCode,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.id, existing[0].id));
  }

  const row = {
    id: opts.id,
    userId: opts.userId,
    token: opts.token,
    platform: opts.platform,
    surface: opts.surface,
    marketCode: opts.marketCode,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(pushSubscriptions).values(row);
  return row as PushSubscriptionRow;
};

/**
 * Remove a push subscription by token. Called when FCM returns
 * `DeviceNotRegistered` / `InvalidToken`, or on logout.
 */
export const removePushToken = async (
  db: Db,
  opts: { token: string; userId: string },
): Promise<void> => {
  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.token, opts.token),
        eq(pushSubscriptions.userId, opts.userId),
      ),
    );
};

/**
 * Remove all push subscriptions for a user. Called on logout
 * (invalidate all devices).
 */
export const removePushTokensByUser = async (
  db: Db,
  opts: { userId: string },
): Promise<number> => {
  const result = await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, opts.userId));
  return (result.meta?.changes ?? 0) as number;
};

/**
 * Get push tokens for all users attending a specific event.
 * Joins push_subscriptions → event_rsvps to find tokens for
 * RSVP'd users only. Returns token + platform + surface.
 *
 * Used by the push sender to fan out notifications to all
 * attendees of an event.
 */
export const getPushTokensForEvent = async (
  db: Db,
  opts: { eventId: string },
): Promise<
  Array<{
    token: string;
    platform: string;
    surface: string;
    userId: string;
  }>
> => {
  const { eventRsvps, pushSubscriptions: ps } = await import('./schema.js');

  const rows = await db
    .select({
      token: ps.token,
      platform: ps.platform,
      surface: ps.surface,
      userId: ps.userId,
    })
    .from(ps)
    .innerJoin(eventRsvps, eq(ps.userId, eventRsvps.userId))
    .where(eq(eventRsvps.eventId, opts.eventId));

  return rows;
};

/**
 * Every registered token for a member, entitled to delivery or not.
 *
 * Kept for administration and for the export PF-09 owes a member about their own devices. It is not
 * the reader a dispatcher wants: it includes subscriptions whose session has been signed out, which
 * is precisely what {@link listDeliverablePushTokens} exists to exclude. Sending from this list is
 * how a signed-out device keeps buzzing.
 */
export const listAllPushTokensByUser = async (
  db: Db,
  opts: { userId: string },
): Promise<PushSubscriptionRow[]> => {
  return db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, opts.userId));
};
