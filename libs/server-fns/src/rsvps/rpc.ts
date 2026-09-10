import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { appValidator, handleResult } from '@founders-coffee/core';

import { requireAuth } from '../authz.js';
import { requirePermission } from '../auth-middleware.js';
import { getDb } from '../db.js';
import { rateLimit } from '../rate-limit.js';
import { cancelRsvpResolver, createRsvpResolver } from './resolver.js';

const rsvpCreateSchema = z.object({
  eventId: z.string().min(1),
});

const rsvpCancelSchema = z.object({
  eventId: z.string().min(1),
});

/**
 * Create an RSVP for an event. Requires `rsvp:create` permission (member/host/moderator/admin).
 * Returns `{ status: 'going' }` on success, or throws `already_rsvpd`.
 */
export const createRsvp = createServerFn({ method: 'POST', strict: false })
  .middleware([
    requirePermission('rsvp', 'create'),
    rateLimit('create_rsvp', 10, 600_000),
  ])
  .validator(appValidator(rsvpCreateSchema))
  .handler(async ({ context, data }) => {
    const session = requireAuth(context.session);
    return handleResult(
      createRsvpResolver(getDb(), {
        eventId: data.eventId,
        userId: session.user.id,
      }),
    );
  });

/**
 * Cancel an RSVP. Requires `rsvp:update` permission (member/host/moderator/admin).
 * Ownership-gated: only the RSVP owner can cancel.
 */
export const cancelRsvp = createServerFn({ method: 'POST', strict: false })
  .middleware([
    requirePermission('rsvp', 'update'),
    rateLimit('cancel_rsvp', 10, 600_000),
  ])
  .validator(appValidator(rsvpCancelSchema))
  .handler(async ({ context, data }) => {
    const session = requireAuth(context.session);
    return handleResult(
      cancelRsvpResolver(getDb(), {
        eventId: data.eventId,
        userId: session.user.id,
      }),
    );
  });
