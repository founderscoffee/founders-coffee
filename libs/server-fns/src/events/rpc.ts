import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';

import { appValidator, handleResult } from '@founders-coffee/core';

import { requireAuth } from '../authz.js';
import { requirePermission } from '../auth-middleware.js';
import { resolveSession } from '../auth.js';
import { getDb } from '../db.js';
import { getMapProvider } from '../maps/runtime.js';
import { rateLimit } from '../rate-limit.js';
import { requireEventCreateTurnstile } from '../turnstile/middleware.js';
import { attachAttendance } from './attendance.js';
import { createEventResolver, listEvents, resolveEvent } from './resolver.js';
import { eventCreateRequestSchema } from './schemas.js';

/**
 * Create a new free event (FR-E1). Requires the `event:create` permission (host/moderator/admin).
 * The host's session provides the `hostId`. The input is Zod-validated via `appValidator`. The
 * resolver generates the id + slug, validates the geo state/city, and inserts the row.
 */
export const createEvent = createServerFn({ method: 'POST', strict: false })
  .middleware([
    requirePermission('event', 'create'),
    rateLimit('create_event', 5, 600_000),
    requireEventCreateTurnstile,
  ])
  .validator(appValidator(eventCreateRequestSchema))
  .handler(async ({ context, data }) => {
    const session = requireAuth(context.session);
    return handleResult(
      createEventResolver(
        getDb(),
        getMapProvider(),
        session.user.id,
        data.event,
      ),
    );
  });

/**
 * Get a single event by id or (marketCode + slug). Public — no auth required.
 * Attaches attendance fields (goingCount, remaining, viewerRsvp).
 */
export const getEvent = createServerFn({ strict: false })
  .validator(
    z.object({
      id: z.string().optional(),
      marketCode: z.string().optional(),
      slug: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const event = await handleResult(resolveEvent(db, data));
    const session = await resolveSession(getRequest().headers);
    const [enriched] = await attachAttendance(db, [event], session?.user?.id);
    return enriched;
  });

/**
 * List upcoming published events (composite cursor). Public. Pass `afterStartsAt` (a startsAt epoch
 * ms) + `afterId` (the last item's id) for pagination; with both, the query continues strictly after
 * that `(startsAt, id)` pair so tied `startsAt` values are never skipped. Only `afterStartsAt` falls
 * back to `startsAt > afterStartsAt`. Optionally scope to a marketCode and/or cityCode. Returns feed
 * items with display city names attached (server-side — geo data is never bundled to the client).
 * Attaches attendance fields for each event.
 */
export const getUpcomingEvents = createServerFn({ strict: false })
  .validator(
    z.object({
      marketCode: z.string().optional(),
      cityCode: z.string().optional(),
      afterStartsAt: z.number().optional(),
      afterId: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(20),
    }),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const page = await listEvents(db, data);
    const session = await resolveSession(getRequest().headers);
    const enriched = await attachAttendance(db, page.items, session?.user?.id);
    return { ...page, items: enriched };
  });
