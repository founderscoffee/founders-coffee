import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';

import { appValidator, handleResult } from '@founders-coffee/core';

import { requirePermission } from '../auth-middleware.js';
import { requireAuth } from '../authz.js';
import { getDb } from '../db.js';
import { rateLimit } from '../rate-limit.js';
import { privateNoStore } from '../response-cache.js';
import {
  callerSessionToken,
  readDevices,
  revokeDevices,
  unlinkProvider,
} from './sessions.js';
import {
  CONTACT_CHANGE_LIMIT,
  emptyProfileRequestSchema,
  revokeDeviceRequestSchema,
  unlinkProviderRequestSchema,
} from './schemas.js';

const contactChangeProtection = [
  requirePermission('profile', 'update'),
  rateLimit(
    CONTACT_CHANGE_LIMIT.action,
    CONTACT_CHANGE_LIMIT.limit,
    CONTACT_CHANGE_LIMIT.windowMs,
  ),
] as const;

export const getMyDevices = createServerFn({ strict: false })
  .middleware([requirePermission('profile', 'read')])
  .validator(appValidator(emptyProfileRequestSchema))
  .handler(({ context }) => {
    privateNoStore();
    return handleResult(
      readDevices(
        getDb(),
        requireAuth(context.session).user.id,
        callerSessionToken(getRequest().headers),
      ),
    );
  });

export const revokeMyDevice = createServerFn({ method: 'POST', strict: false })
  .middleware(contactChangeProtection)
  .validator(appValidator(revokeDeviceRequestSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      revokeDevices(
        getDb(),
        requireAuth(context.session).user.id,
        data,
        callerSessionToken(getRequest().headers),
      ),
    );
  });

export const unlinkMyProvider = createServerFn({
  method: 'POST',
  strict: false,
})
  .middleware(contactChangeProtection)
  .validator(appValidator(unlinkProviderRequestSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      unlinkProvider(
        getDb(),
        requireAuth(context.session).user.id,
        data.providerId,
      ),
    );
  });
