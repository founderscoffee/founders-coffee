import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';

import { appValidator, handleResult } from '@founders-coffee/core';

import { requirePermission } from '../auth-middleware.js';
import { requireAuth } from '../authz.js';
import { getDb } from '../db.js';
import { rateLimit } from '../rate-limit.js';
import { privateNoStore } from '../response-cache.js';
import {
  readDevices,
  revokeDevices,
  sessionTokenFromCookie,
  unlinkProvider,
} from './sessions.js';
import {
  CONTACT_CHANGE_LIMIT,
  emptyProfileRequestSchema,
  revokeDeviceRequestSchema,
  unlinkProviderRequestSchema,
} from './schemas.js';

/**
 * The caller's own session token, read from the cookie rather than from the payload.
 *
 * The token is what says which device is asking, and a client that could name its own would be
 * able to name somebody else's — keeping a session it does not own while revoking the rest. It is
 * never returned; it only ever travels inward, to be matched against rows the member owns.
 */
const callerSessionToken = (): string | null =>
  sessionTokenFromCookie(getRequest().headers.get('cookie'));

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
        callerSessionToken(),
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
        callerSessionToken(),
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
