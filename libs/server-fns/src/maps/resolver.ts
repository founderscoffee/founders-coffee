import { AppError, err, type Result } from '@founders-coffee/core';
import { geo } from '@founders-coffee/domain';
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

const resolveLocation = (
  input: HostMapContextInput,
): Result<MapProviderLocation> => {
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

export const getHostMapContextResolver = async (
  provider: MapProvider,
  input: HostMapContextInput,
): Promise<Result<HostMapContext>> => {
  const location = resolveLocation(input);
  if (!location.ok) return location;
  const result = await provider.getCityViewport(location.data);
  if (!result.ok) recordFailure(provider, 'city_viewport', input, result.error);
  return result;
};

export const searchEventVenuesResolver = async (
  provider: MapProvider,
  input: VenueSearchInput,
): Promise<Result<readonly VenueCandidate[]>> => {
  const location = resolveLocation(input);
  if (!location.ok) return location;
  const result = await provider.searchVenues({
    ...location.data,
    query: input.query,
  });
  if (!result.ok) recordFailure(provider, 'venue_search', input, result.error);
  return result;
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
