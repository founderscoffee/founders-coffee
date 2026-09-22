import { AppError, err, type Result } from '@founders-coffee/core';
import { geo, venues as venuesDomain } from '@founders-coffee/domain';
import { logger } from '@founders-coffee/observability';

import type {
  HostMapContext,
  MapProvider,
  MapProviderLocation,
  VenueCandidate,
} from './provider.js';
import type {
  HostMapContextInput,
  VenueReverseInput,
  VenueSearchInput,
} from './schemas.js';
import {
  searchSnapshotVenues,
  withoutSnapshotDuplicates,
} from './snapshot-search.js';

/**
 * Attach the canonical city to a provider call, when the caller named one.
 *
 * A city is now optional: the wizard opens on the market and the point decides where the event is.
 * Naming one that does not exist is still an error rather than a silent widening — a bad code in a
 * URL should not quietly become a market-wide search.
 */
const resolveLocation = (
  input: HostMapContextInput,
): Result<MapProviderLocation> => {
  if (!input.cityCode) return { ok: true, data: { ...input, city: undefined } };
  const city = geo.findCity(input.marketCode, input.cityCode);
  return city
    ? { ok: true, data: { ...input, city } }
    : err(
        new AppError(
          'map_city_not_found',
          `Unknown city ${input.cityCode} for ${input.marketCode}`,
        ),
      );
};

const recordFailure = (
  provider: MapProvider,
  operation: string,
  input: HostMapContextInput,
  error: AppError,
): void => {
  logger.warn('map_provider_operation_failed', {
    provider: provider.name,
    operation,
    marketCode: input.marketCode,
    cityCode: input.cityCode,
    errorCode: error.code,
  });
};

/**
 * Where the map opens for a city.
 *
 * The venue snapshot already stores each city's centre and bounds, so a snapshotted city is served
 * without touching the map provider at all — one fewer billed request on every wizard open, and one
 * fewer thing that can rate-limit the search box. Cities outside the snapshot still ask the
 * provider.
 */
export const getHostMapContextResolver = async (
  provider: MapProvider,
  input: HostMapContextInput,
): Promise<Result<HostMapContext>> => {
  const location = resolveLocation(input);
  if (!location.ok) return location;
  const stored = input.cityCode
    ? venuesDomain.getCityViewportSnapshot(input.marketCode, input.cityCode)
    : venuesDomain.getMarketViewport(input.marketCode);
  if (stored) {
    return {
      ok: true,
      data: { center: stored.center, bounds: stored.bounds },
    };
  }
  const result = await provider.getCityViewport(location.data);
  if (!result.ok) recordFailure(provider, 'city_viewport', input, result.error);
  return result;
};

/**
 * The venues a host can pick from, this market's own first and the provider's after them.
 *
 * The snapshot answers what the provider cannot: it holds the cafes of these cities under the names
 * they are known by locally, including Arabic ones, which the provider indexes almost none of. It
 * also answers without a request, so the common query is free.
 *
 * A provider failure is only fatal when the snapshot found nothing. Telling a host that the map is
 * unavailable, while holding the cafe they just typed the name of, would be reporting our own
 * dependency as their problem.
 */
export const searchEventVenuesResolver = async (
  provider: MapProvider,
  input: VenueSearchInput,
): Promise<Result<readonly VenueCandidate[]>> => {
  const location = resolveLocation(input);
  if (!location.ok) return location;
  const known = searchSnapshotVenues(
    input.marketCode,
    input.cityCode,
    input.query,
  );
  const result = await provider.searchVenues({
    ...location.data,
    query: input.query,
  });
  if (!result.ok) {
    recordFailure(provider, 'venue_search', input, result.error);
    return known.length > 0 ? { ok: true, data: known } : result;
  }
  return {
    ok: true,
    data: [...known, ...withoutSnapshotDuplicates(known, result.data)],
  };
};

export const reverseEventVenueResolver = async (
  provider: MapProvider,
  input: VenueReverseInput,
): Promise<Result<VenueCandidate>> => {
  const location = resolveLocation(input);
  if (!location.ok) return location;
  const result = await provider.reverseVenue({
    ...location.data,
    latitude: input.latitude,
    longitude: input.longitude,
  });
  if (!result.ok) recordFailure(provider, 'venue_reverse', input, result.error);
  return result;
};
