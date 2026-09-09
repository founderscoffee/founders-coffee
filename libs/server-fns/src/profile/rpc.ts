import { createServerFn } from '@tanstack/react-start';

import { appValidator, handleResult } from '@founders-coffee/core';

import { requirePermission } from '../auth-middleware.js';
import { requireAuth } from '../authz.js';
import { getDb } from '../db.js';
import { rateLimit } from '../rate-limit.js';
import { privateNoStore } from '../response-cache.js';
import { requireProfileTurnstile } from '../turnstile/middleware.js';
import {
  readOwnerProfile,
  readPublicProfile,
  saveDisplayName,
  saveOwnerProfile,
} from './resolver.js';
import {
  emptyProfileRequestSchema,
  PROFILE_READ_LIMIT,
  PROFILE_UPDATE_LIMIT,
  publicProfileRequestSchema,
  updateDisplayNameRequestSchema,
  updateProfileRequestSchema,
} from './schemas.js';

const profileWriteProtection = [
  requirePermission('profile', 'update'),
  rateLimit(
    PROFILE_UPDATE_LIMIT.action,
    PROFILE_UPDATE_LIMIT.limit,
    PROFILE_UPDATE_LIMIT.windowMs,
  ),
  requireProfileTurnstile,
] as const;

export const getMyProfile = createServerFn({ strict: false })
  .middleware([requirePermission('profile', 'read')])
  .validator(appValidator(emptyProfileRequestSchema))
  .handler(({ context }) => {
    privateNoStore();
    return handleResult(
      readOwnerProfile(getDb(), requireAuth(context.session).user.id),
    );
  });

export const getPublicProfile = createServerFn({ strict: false })
  .middleware([
    rateLimit(
      PROFILE_READ_LIMIT.action,
      PROFILE_READ_LIMIT.limit,
      PROFILE_READ_LIMIT.windowMs,
    ),
  ])
  .validator(appValidator(publicProfileRequestSchema))
  .handler(({ data }) => {
    privateNoStore();
    return handleResult(readPublicProfile(getDb(), data.userId));
  });

export const updateMyProfile = createServerFn({ method: 'POST', strict: false })
  .middleware(profileWriteProtection)
  .validator(appValidator(updateProfileRequestSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      saveOwnerProfile(
        getDb(),
        requireAuth(context.session).user.id,
        data.profile,
      ),
    );
  });

export const updateMyDisplayName = createServerFn({
  method: 'POST',
  strict: false,
})
  .middleware(profileWriteProtection)
  .validator(appValidator(updateDisplayNameRequestSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      saveDisplayName(getDb(), requireAuth(context.session).user.id, data),
    );
  });
