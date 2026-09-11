import { logger } from '@founders-coffee/observability';

import { enqueueCloseoutPrompt } from '../notifications/closeout-prompt.js';
import type { Db, Event } from '@founders-coffee/db';

/**
 * Schedule the post-event closeout prompt, without ever being able to undo the event.
 *
 * Best-effort by construction, and the construction is the point. CO-05 requires that an intent or
 * alarm failure never rolls back or duplicates an already-created event, so this swallows everything
 * and returns: the event is durable before it is called, the caller ignores the result, and there is
 * no path from a failure here back to the row that was written.
 *
 * A swallowed failure is not a lost prompt. The nightly backfill re-derives anything missing from
 * `events` left-joined against its own rows, so the cost of a throw here is a delay, not an absence
 * — which is what makes swallowing it the right trade rather than a shrug.
 *
 * It is logged at `info` when it merely skips and `error` when it throws, so an environment where
 * this fails routinely is visible rather than quietly leaning on the backfill every night.
 *
 * Called from `createEventWithTelemetry` rather than from `createEventResolver`, and the placement is
 * load-bearing. This module reaches `notifications/context.ts` and therefore `cloudflare:workers`;
 * `events/resolver.ts` is on the browser's import graph — `markets/index.ts` value-exports a resolver
 * that imports `listEvents` from it — so a single edge from there breaks the client bundle outright.
 * `create.ts` is reached only through the server function's handler, which the Start plugin strips
 * from the client build, so the edge stops at the boundary.
 */
export const scheduleEventCloseoutPrompt = async (
  db: Db,
  event: Event,
): Promise<void> => {
  try {
    const outcome = await enqueueCloseoutPrompt(db, {
      id: event.id,
      hostId: event.hostId,
      marketCode: event.marketCode,
      title: event.title,
      venue: event.venue,
      slug: event.slug,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
    });
    if (outcome !== 'scheduled')
      logger.info('closeout_prompt_skipped', { eventId: event.id, outcome });
  } catch (error) {
    logger.error('closeout_prompt_failed', {
      eventId: event.id,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
};
