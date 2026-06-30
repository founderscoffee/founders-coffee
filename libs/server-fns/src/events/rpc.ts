import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

import { appValidator, handleResult, marketCodeSchema } from '@founders-coffee/core';

import { requireAuth } from '../authz.js';
import { requirePermission } from '../auth-middleware.js';
import { getDb } from '../db.js';
import { createEventResolver, listEvents, resolveEvent, type EventCreateInput } from './resolver.js';

const eventCreateSchema = z.object({
  marketCode: marketCodeSchema,
  stateCode: z.string(),
  cityCode: z.string(),
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(2000),
  venue: z.string().min(2).max(200),
  startsAt: z.number().int().positive(),
  capacity: z.number().int().min(0).max(10000).default(0),
  language: z.enum(['ar', 'en', 'fr', 'ar_en', 'ar_fr']),
  category: z.enum(['coffee-meetup', 'workshop', 'demo-day']),
});

/**
 * Create a new free event (FR-E1). Requires the `event:create` permission (host/moderator/admin).
 * The host's session provides the `hostId`. The input is Zod-validated via `appValidator`. The
 * resolver generates the id + slug, validates the geo state/city, and inserts the row.
 */
export const createEvent = createServerFn({ strict: false })
  .middleware([requirePermission('event', 'create')])
  .validator(appValidator(eventCreateSchema))
  .handler(async ({ context, data }) => {
    const session = requireAuth(context.session);
    return handleResult(createEventResolver(getDb(), session.user.id, data as EventCreateInput));
  });

/** Get a single event by id or (marketCode + slug). Public — no auth required. */
export const getEvent = createServerFn({ strict: false })
  .validator(
    z.object({
      id: z.string().optional(),
      marketCode: z.string().optional(),
      slug: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => handleResult(resolveEvent(getDb(), data)));

/**
 * List upcoming published events (cursor-based). Public. Pass `after` (a startsAt epoch ms) for
 * pagination — returns only events with `startsAt > after`, ordered ASC. Optionally scope to a
 * marketCode and/or cityCode.
 */
export const getUpcomingEvents = createServerFn({ strict: false })
  .validator(
    z.object({
      marketCode: z.string().optional(),
      cityCode: z.string().optional(),
      after: z.number().optional(),
      limit: z.number().int().min(1).max(100).default(20),
    }),
  )
  .handler(async ({ data }) => listEvents(getDb(), data));
