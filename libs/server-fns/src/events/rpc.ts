import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';

import { geo } from '@founders-coffee/domain';

import { appValidator, handleResult } from '@founders-coffee/core';
import { reportError } from '@founders-coffee/observability';

import { requireAuth } from '../authz.js';
import { requirePermission } from '../auth-middleware.js';
import { resolveSession } from '../auth.js';
import { getDb } from '../db.js';
import { workerEnv, workerMetrics } from '../env.js';
import { getMapProvider } from '../maps/runtime.js';
import { rateLimit } from '../rate-limit.js';
import { privateNoStore } from '../response-cache.js';
import { requireEventCreateWafRule } from '../turnstile/middleware.js';
import { attachAttendance } from './attendance.js';
import { readEventCard } from './card.js';
import { cancelEventResolver } from './cancel.js';
import { listHostedEventPage } from './hosted.js';
import { listJoinedEventPage } from './joined.js';
import { readPublicEventFeed } from './public-feed.js';
import { readRepeatEventTemplate } from './repeat.js';
import { createEventWithTelemetry } from './create.js';
import { updateEventResolver } from './update.js';
import { listEvents, resolveEvent } from './resolver.js';
import {
  eventCancelRequestSchema,
  eventCreateRequestSchema,
  eventUpdateRequestSchema,
  hostedEventsRequestSchema,
  joinedEventsRequestSchema,
  publicEventFeedRequestSchema,
  repeatEventRequestSchema,
} from './schemas.js';

const notifyLiveCancellation = async (eventId: string): Promise<void> => {
  const namespace = workerEnv().EVENT_LIVE;
  if (!namespace) return;
  try {
    const stub = namespace.get(namespace.idFromName(`event:${eventId}`));
    const response = await stub.fetch(
      new Request(
        `https://event-live.internal/internal/cancel/${encodeURIComponent(eventId)}`,
        {
          method: 'POST',
          headers: { 'x-event-live-internal': '1' },
        },
      ),
    );
    if (!response.ok)
      throw new Error(`Live cancellation returned ${response.status}`);
  } catch (error) {
    reportError(error, { operation: 'cancel_event_live', eventId });
  }
};

/**
 * Create a new free event (FR-E1). Requires the `event:create` permission (host/moderator/admin).
 * The host's session provides the `hostId`. The input is Zod-validated via `appValidator`. The
 * resolver generates the id + slug, validates the geo state/city, and inserts the row; the
 * telemetry wrapper adds the EC-08 request/success/failure logs and the `events_created` metric.
 *
 * There is deliberately no bot challenge here. Turnstile refuses to issue a token to any automated
 * browser, whatever the widget mode, which made the release gate unable to exercise the one path
 * it exists to protect; the product owner chose to drop the challenge rather than lose that
 * coverage. What remains is the authenticated `event:create` permission, the five-per-ten-minute
 * `create_event` Durable Object bucket, and the account-side edge rule — so creation is still
 * bounded per identity and per IP, but it is no longer proof-of-humanity gated.
 */
export const createEvent = createServerFn({ method: 'POST', strict: false })
  .middleware([
    requirePermission('event', 'create'),
    rateLimit('create_event', 5, 600_000),
    requireEventCreateWafRule,
  ])
  .validator(appValidator(eventCreateRequestSchema))
  .handler(async ({ context, data }) => {
    const session = requireAuth(context.session);
    return handleResult(
      createEventWithTelemetry(
        getDb(),
        getMapProvider(),
        workerMetrics(),
        session.user.id,
        data.event,
      ),
    );
  });

/**
 * Change a meetup that is already published (#14). Host-only, enforced in the resolver rather than
 * by a permission: `event:create` says a member may host, not that they may edit this one.
 *
 * Rate-limited more tightly than creation. Each save that moves the time notifies every attendee,
 * so a host nudging the start repeatedly is a source of messages to other people's phones rather
 * than a cost to themselves — the limit is the only thing standing between a fidgety afternoon and
 * a dozen notifications about a meetup that never actually moved.
 */
export const updateEvent = createServerFn({ method: 'POST', strict: false })
  .middleware([
    requirePermission('event', 'create'),
    rateLimit('update_event', 10, 600_000),
  ])
  .validator(appValidator(eventUpdateRequestSchema))
  .handler(async ({ context, data }) => {
    const session = requireAuth(context.session);
    return handleResult(
      updateEventResolver(getDb(), getMapProvider(), {
        eventId: data.eventId,
        actorId: session.user.id,
        input: data.event,
      }),
    );
  });

/**
 * Get a single event by id or (marketCode + slug). Public — no auth required.
 * Attaches attendance fields (goingCount, viewerRsvp).
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
    privateNoStore();
    const db = getDb();
    const event = await handleResult(resolveEvent(db, data));
    const session = await resolveSession(getRequest().headers);
    const [enriched] = await attachAttendance(db, [event], session?.user?.id);
    const city = geo.findCity(event.marketCode, event.cityCode);
    return {
      ...enriched,
      cityName: city?.name ?? event.cityCode,
      cityNameAr: city?.nameAr ?? city?.name ?? event.cityCode,
      citySlug: city?.slug ?? null,
    };
  });

/**
 * The fields a shared meetup's social card draws.
 *
 * Deliberately not `getEvent`. That one answers for a reader — it resolves the session, attaches
 * whether they are going, and marks the response `private, no-store`, all three of which are wrong
 * here: the card is rendered for a link scraper, must be identical for everyone, and is the one
 * response on this site that wants to be cached hard and shared.
 *
 * It answers for a published meetup only. A draft or a cancelled one has no card, and the caller
 * falls back to the site's default image rather than publishing a preview of something nobody can
 * turn up to.
 */
export const getEventCardData = createServerFn({ strict: false })
  .validator(z.object({ id: z.string() }))
  .handler(({ data }) => readEventCard(getDb(), data.id));

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
      hostId: z.string().max(64).optional(),
      afterStartsAt: z.number().optional(),
      afterId: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(20),
    }),
  )
  .handler(async ({ data }) => {
    privateNoStore();
    const db = getDb();
    const page = await listEvents(db, data);
    const session = await resolveSession(getRequest().headers);
    const enriched = await attachAttendance(db, page.items, session?.user?.id);
    return { ...page, items: enriched };
  });

export const getPublicEventFeed = createServerFn({ strict: false })
  .validator(appValidator(publicEventFeedRequestSchema))
  .handler(({ data }) => handleResult(readPublicEventFeed(getDb(), data)));

/**
 * Cancel an event the caller hosts (FR-E1 counterpart). Requires a session; the resolver refuses
 * any caller who is not the event's host, so ownership is checked against the row rather than
 * trusted from the client. Rate-limited on the same Durable Object bucket family as creation: a
 * cancellation fans out a notice to every attendee, which is the expensive part.
 */
export const cancelEvent = createServerFn({ method: 'POST', strict: false })
  .middleware([
    requirePermission('event', 'create'),
    rateLimit('cancel_event', 5, 600_000),
  ])
  .validator(appValidator(eventCancelRequestSchema))
  .handler(async ({ context, data }) => {
    const session = requireAuth(context.session);
    const result = await handleResult(
      cancelEventResolver(getDb(), {
        eventId: data.eventId,
        actorId: session.user.id,
        reason: data.reason,
      }),
    );
    await notifyLiveCancellation(data.eventId);
    return result;
  });

/**
 * One page of a host's event history with the true total. Public — a host's gatherings are the
 * evidence a stranger uses to decide whether to come, and nothing here is owner-only.
 */
export const getHostedEvents = createServerFn({ strict: false })
  .validator(appValidator(hostedEventsRequestSchema))
  .handler(({ data }) => listHostedEventPage(getDb(), data));

export const getRepeatEventTemplate = createServerFn({ strict: false })
  .middleware([requirePermission('event', 'create')])
  .validator(appValidator(repeatEventRequestSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      readRepeatEventTemplate(getDb(), {
        eventId: data.eventId,
        actorId: requireAuth(context.session).user.id,
      }),
    );
  });

/**
 * One page of the gatherings the caller has joined. Owner-only, and owner-only by construction.
 *
 * The request schema carries no user id. A public `getHostedEvents` answers what somebody has run,
 * which is what a stranger reads before deciding to come; this answers where somebody has *been*,
 * which is nobody else's to ask. Reading the id from the session rather than validating one from
 * the body means there is no parameter an authorization check could be forgotten on.
 */
export const getMyJoinedEvents = createServerFn({ strict: false })
  .middleware([requirePermission('rsvp', 'read')])
  .validator(appValidator(joinedEventsRequestSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return listJoinedEventPage(getDb(), {
      ...data,
      userId: requireAuth(context.session).user.id,
    });
  });
