import { AppError, err, ok, type Result } from '@founders-coffee/core';

import {
  distanceMeters,
  featureCountry,
  isAddressableLocation,
  isSupportedVenue,
  isWithinBounds,
  matchesCity,
  toVenue,
  MAX_REVERSE_DISTANCE_METERS,
} from './mapbox-filters.js';
import {
  mapboxCollectionSchema,
  type MapboxFeature,
} from './mapbox-schemas.js';
import type {
  HostMapContext,
  MapProvider,
  MapProviderLocation,
} from './provider.js';

const MAPBOX_SEARCH_URL = 'https://api.mapbox.com/search/searchbox/v1';
const MAPBOX_TIMEOUT_MS = 6_000;
const MAPBOX_RESULT_LIMIT = 10;
const VENUE_TYPES = 'poi,address,street';

type MapboxFetcher = (input: string, init?: RequestInit) => Promise<Response>;

const mapboxFailure = (message: string): Result<never> =>
  err(new AppError('map_provider_unavailable', message));

export const createMapboxProvider = (
  accessToken: string,
  fetcher: MapboxFetcher = fetch,
): MapProvider => {
  const fetchCollection = async (
    path: string,
    params: Readonly<Record<string, string>>,
  ): Promise<Result<readonly MapboxFeature[]>> => {
    const url = new URL(`${MAPBOX_SEARCH_URL}/${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set('access_token', accessToken);
    try {
      const response = await fetcher(url.toString(), {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(MAPBOX_TIMEOUT_MS),
      });
      if (!response.ok) {
        return mapboxFailure(`Map provider responded with ${response.status}`);
      }
      const parsed = mapboxCollectionSchema.safeParse(await response.json());
      if (!parsed.success) {
        return mapboxFailure('Map provider returned an invalid response');
      }
      return ok(parsed.data.features);
    } catch {
      return mapboxFailure('Map provider request failed');
    }
  };

  const resolveCity = async (
    input: MapProviderLocation,
  ): Promise<Result<{ feature: MapboxFeature; context: HostMapContext }>> => {
    const result = await fetchCollection('forward', {
      q: `${input.city.name}, ${input.marketCode}`,
      country: input.marketCode,
      language: input.locale,
      limit: '5',
      types: 'city,place,locality',
    });
    if (!result.ok) return result;
    const feature = result.data.find(
      (candidate) =>
        featureCountry(candidate) === input.marketCode &&
        matchesCity(candidate, input),
    );
    const bounds = feature?.bbox ?? feature?.properties.bbox;
    if (!feature || !bounds) {
      return err(
        new AppError(
          'map_city_not_found',
          `Map provider could not resolve city ${input.city.code}`,
        ),
      );
    }
    const [longitude, latitude] = feature.geometry.coordinates;
    return ok({
      feature,
      context: {
        center: { latitude, longitude },
        bounds,
      },
    });
  };

  const getCityViewport: MapProvider['getCityViewport'] = async (input) => {
    const result = await resolveCity(input);
    return result.ok ? ok(result.data.context) : result;
  };

  const searchVenues: MapProvider['searchVenues'] = async (input) => {
    const cityResult = await resolveCity(input);
    if (!cityResult.ok) return cityResult;
    const { bounds, center } = cityResult.data.context;
    const result = await fetchCollection('forward', {
      q: input.query,
      bbox: bounds.join(','),
      proximity: `${center.longitude},${center.latitude}`,
      country: input.marketCode,
      language: input.locale,
      limit: String(MAPBOX_RESULT_LIMIT),
      types: VENUE_TYPES,
    });
    if (!result.ok) return result;
    const candidates = result.data.filter((feature) => {
      const [longitude, latitude] = feature.geometry.coordinates;
      return (
        featureCountry(feature) === input.marketCode &&
        matchesCity(feature, input) &&
        isWithinBounds(longitude, latitude, bounds) &&
        (isSupportedVenue(feature) || isAddressableLocation(feature))
      );
    });
    const supported = candidates.filter(isSupportedVenue);
    const addressable = candidates.filter(
      (feature) => !isSupportedVenue(feature),
    );
    return ok([...supported, ...addressable].map(toVenue));
  };

  const reverseVenue: MapProvider['reverseVenue'] = async (input) => {
    const cityResult = await resolveCity(input);
    if (!cityResult.ok) return cityResult;
    const { bounds } = cityResult.data.context;
    if (!isWithinBounds(input.longitude, input.latitude, bounds)) {
      return err(
        new AppError(
          'map_venue_outside_city',
          `Coordinates are outside city ${input.city.code}`,
        ),
      );
    }
    const result = await fetchCollection('reverse', {
      longitude: String(input.longitude),
      latitude: String(input.latitude),
      country: input.marketCode,
      language: input.locale,
      limit: String(MAPBOX_RESULT_LIMIT),
      types: VENUE_TYPES,
    });
    if (!result.ok) return result;
    const nearby = result.data.filter((candidate) => {
      const [longitude, latitude] = candidate.geometry.coordinates;
      return (
        featureCountry(candidate) === input.marketCode &&
        matchesCity(candidate, input) &&
        distanceMeters(input, { latitude, longitude }) <=
          MAX_REVERSE_DISTANCE_METERS
      );
    });
    const feature =
      nearby.find(isSupportedVenue) ?? nearby.find(isAddressableLocation);
    return feature
      ? ok(toVenue(feature))
      : err(
          new AppError(
            'map_venue_unsupported',
            'Select a café, coworking space, or a street address in this city',
          ),
        );
  };

  return {
    name: 'mapbox',
    getCityViewport,
    searchVenues,
    reverseVenue,
  };
};
