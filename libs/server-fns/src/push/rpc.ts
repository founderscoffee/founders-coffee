import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { appValidator, id } from '@founders-coffee/core';
import { registerPushToken, removePushToken } from '@founders-coffee/db';

import { requirePermission } from '../auth-middleware.js';
import { rateLimit } from '../rate-limit.js';
import { requireAuth } from '../authz.js';
import { getDb } from '../db.js';

const registerPushSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android', 'web']),
  surface: z.enum(['pwa', 'rn']),
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
