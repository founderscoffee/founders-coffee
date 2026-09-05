import { type Result } from '@founders-coffee/core';
import { type Db, type Event } from '@founders-coffee/db';
import { type EventCreateInput } from '@founders-coffee/domain';
import {
  logger,
  reportError,
  type Metrics,
} from '@founders-coffee/observability';

import type { MapProvider } from '../maps/provider.js';
import { createEventResolver } from './resolver.js';

export const EVENTS_CREATED_METRIC = 'events_created';

interface EventCreateTelemetry {
  readonly hostId: string;
  readonly marketCode: string;
  readonly cityCode: string | null;
  readonly category: string;
  readonly language: string;
  readonly capacity: number;
  readonly durationMinutes: number;
}

/**
 * Project a creation command down to the fields that may leave the Worker as telemetry.
 *
 * The command also carries the title, description, venue name and venue address — host-authored
 * free text that NFR-7 keeps out of logs and metrics, and that no dashboard aggregates by. Building
 * the context from an explicit allow-list rather than spreading the input is what keeps that true
 * when the schema gains a field: a new free-text column is absent here until someone adds it
 * deliberately. Coordinates are omitted for the same reason — they locate a specific venue.
 *
 * `cityCode` is null on the request line and filled in on success, because the city is now derived
 * from the point rather than chosen: reading it off the input would report whatever the host
 * happened to override, or nothing at all, instead of where the event actually landed.
 */
const telemetryFor = (
  hostId: string,
  input: EventCreateInput,
): EventCreateTelemetry => ({
  hostId,
  marketCode: input.marketCode,
  cityCode: input.cityCode ?? null,
  category: input.category,
  language: input.language,
  capacity: input.capacity,
  durationMinutes: Math.round((input.endsAt - input.startsAt) / 60_000),
});

/**
 * Record one created event on the P1-019 Analytics Engine dataset.
 *
 * A metrics outage must never cost a host their event: the row is already committed by the time
 * this runs, so a missing binding is a warning and a throwing `writeDataPoint` is reported, never
 * propagated. The absent-binding case is logged rather than ignored because a silently unmetered
 * environment is indistinguishable from an environment where nobody creates events.
 *
 * The event language is sent as the `locale` dimension. That is only sound because the language
 * enum is exactly `ar | en | fr` — the same values the dimension already means. It previously also
 * carried `ar_en` and `ar_fr`, which would have made `WHERE blob3 = 'ar'` quietly wrong for every
 * dashboard reading that blob; narrowing the enum is what makes the breakdown safe to record.
 */
const recordEventCreated = (
  metrics: Metrics | null,
  telemetry: EventCreateTelemetry,
): void => {
  if (!metrics) {
    logger.warn('events_created_metric_unavailable', { ...telemetry });
    return;
  }
  try {
    metrics.trackEvent(EVENTS_CREATED_METRIC, {
      market: telemetry.marketCode,
      city: telemetry.cityCode ?? undefined,
      locale: telemetry.language,
    });
  } catch (error) {
    reportError(error, { operation: EVENTS_CREATED_METRIC });
  }
};

/**
 * Create an event and emit its observability record (EC-08).
 *
 * Wraps {@link createEventResolver} rather than living inside it so the resolver stays a pure
 * persistence decision that the D1 tests can drive without asserting on telemetry. Every request
 * produces exactly one entry log and exactly one outcome log, correlated by the request id the
 * `requestContextMiddleware` puts in the ambient context, so a failed creation can be traced from
 * the host's report to the rejecting stage. The `events_created` metric is emitted only on the
 * success path — after the row is durably committed — so a rejected or failed write never inflates
 * the dashboards.
 */
export const createEventWithTelemetry = async (
  db: Db,
  mapProvider: MapProvider,
  metrics: Metrics | null,
  hostId: string,
  input: EventCreateInput,
): Promise<Result<Event>> => {
  const telemetry = telemetryFor(hostId, input);
  logger.info('event_create_requested', { ...telemetry });

  const result = await createEventResolver(db, mapProvider, hostId, input);
  if (!result.ok) {
    logger.warn('event_create_rejected', {
      ...telemetry,
      errorCode: result.error.code,
    });
    return result;
  }

  const resolved: EventCreateTelemetry = {
    ...telemetry,
    cityCode: result.data.cityCode,
  };
  logger.info('event_create_succeeded', {
    ...resolved,
    eventId: result.data.id,
    stateCode: result.data.stateCode,
  });
  recordEventCreated(metrics, resolved);
  return result;
};
