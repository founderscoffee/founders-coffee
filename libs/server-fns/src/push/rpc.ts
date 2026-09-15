import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import {
  appValidator,
  id,
  pushPlatformSchema,
  pushSurfaceSchema,
} from '@founders-coffee/core';
import {
  pushTokenState,
  registerPushToken,
  removePushToken,
} from '@founders-coffee/db';

import { requirePermission } from '../auth-middleware.js';
import { rateLimit } from '../rate-limit.js';
import { requireAuth } from '../authz.js';
import { getDb } from '../db.js';

const registerPushSchema = z.object({
  token: z.string().min(1),
  platform: pushPlatformSchema,
  surface: pushSurfaceSchema,
  marketCode: z.string().min(2),
});

/**
 * Register a push notification token for the current user.
 * Called after the user accepts the push permission prompt.
 * Upserts on token (unique) — updates user_id if the token already exists.
 */
export const registerPushTokenFn = createServerFn({
  method: 'POST',
  strict: false,
})
  .middleware([
    requirePermission('push', 'manage'),
    rateLimit('push_token', 20, 600_000),
  ])
  .validator(appValidator(registerPushSchema))
  .handler(async ({ context, data }) => {
    const session = requireAuth(context.session);
    const db = getDb();

    await registerPushToken(db, {
      id: id('pst'),
      userId: session.user.id,
      token: data.token,
      platform: data.platform,
      surface: data.surface,
      marketCode: data.marketCode,
    });
  });

/**
 * Remove a push notification token. Called on logout or when
 * FCM returns DeviceNotRegistered / InvalidToken.
 */
export const removePushTokenFn = createServerFn({
  method: 'POST',
  strict: false,
})
  .middleware([
    requirePermission('push', 'manage'),
    rateLimit('push_token', 20, 600_000),
  ])
  .validator(appValidator(z.object({ token: z.string().min(1) })))
  .handler(async ({ context, data }) => {
    const session = requireAuth(context.session);
    const db = getDb();
    await removePushToken(db, { token: data.token, userId: session.user.id });
  });

/**
 * Whether this device's token is registered, and whether delivery to it would actually happen.
 *
 * The preferences screen asks because the browser cannot tell it. `Notification.permission` says
 * only that the member said yes once, on this device; it says nothing about whether the token
 * reached us, or whether the session that owns the subscription has since been signed out from the
 * devices screen. Both of those are states the member is entitled to see rather than discover by
 * not receiving anything.
 *
 * Owner-scoped by construction: the answer is computed for the caller's own id, so asking about
 * somebody else's token returns the same "not registered" as asking about a token nobody holds.
 */
export const getPushDeliveryState = createServerFn({
  method: 'POST',
  strict: false,
})
  .middleware([
    requirePermission('push', 'manage'),
    rateLimit('push_state', 60, 600_000),
  ])
  .validator(appValidator(z.object({ token: z.string().min(1).max(4096) })))
  .handler(({ context, data }) =>
    pushTokenState(getDb(), {
      userId: requireAuth(context.session).user.id,
      token: data.token,
    }),
  );
