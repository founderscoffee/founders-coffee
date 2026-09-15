import { and, eq, sql } from 'drizzle-orm';

import type { PushPlatform, PushSurface } from '@founders-coffee/core';

import type { Db } from './db.js';
import { listDeliverablePushTokens } from './notification-destinations.js';
import {
  accountPreferences,
  pushSubscriptions,
  type PushSubscriptionRow,
} from './schema.js';

/**
 * Record that this member has push on, because a device just registered for it.
 *
 * `push_enabled` defaults to false and is read at send time, so without this a member who granted
 * the browser permission and registered a device would still be refused every push: the switch
 * describing their state would say off while their device said on. Registration is the affirmative
 * gesture, so it is what writes the switch.
 *
 * Upserted rather than updated because the preferences row is created lazily, on the first profile
 * save — a member who has never opened that screen has no row, and an UPDATE would silently write
 * nothing and leave push refused.
 */
const recordPushEnabled = async (db: Db, userId: string): Promise<void> => {
  await db
    .insert(accountPreferences)
    .values({ userId, pushEnabled: true })
    .onConflictDoUpdate({
      target: accountPreferences.userId,
      set: { pushEnabled: true, updatedAt: sql`(unixepoch())` },
    });
};

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
    platform: PushPlatform;
    surface: PushSurface;
    marketCode: string;
  },
): Promise<PushSubscriptionRow> => {
  const existing = await db
    .select({ id: pushSubscriptions.id, userId: pushSubscriptions.userId })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.token, opts.token))
    .limit(1);

  await recordPushEnabled(db, opts.userId);

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
 * What this one device's push registration is actually worth right now.
 *
 * The preferences screen has to tell three states apart that look identical from the browser:
 * permission granted but never registered, registered, and registered but no longer deliverable
 * because the session it belongs to was signed out. Only the last two can be answered here, and
 * `deliverable` deliberately reuses {@link listDeliverablePushTokens} rather than re-deriving the
 * rule — a screen that reported its own idea of eligibility would eventually disagree with the
 * dispatcher, and the member would be told they are reachable while nothing arrives.
 */
export const pushTokenState = async (
  db: Db,
  opts: { userId: string; token: string },
): Promise<{ registered: boolean; deliverable: boolean }> => {
  const rows = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.userId, opts.userId),
        eq(pushSubscriptions.token, opts.token),
      ),
    )
    .limit(1);
  if (rows.length === 0) return { registered: false, deliverable: false };

  const deliverable = await listDeliverablePushTokens(db, opts.userId);
  return { registered: true, deliverable: deliverable.includes(opts.token) };
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
