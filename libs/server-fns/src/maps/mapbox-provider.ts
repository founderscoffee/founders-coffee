import { z } from 'zod';

import { AppError, err, ok, type Result } from '@founders-coffee/core';

import type {
  HostMapContext,
  MapProvider,
  MapProviderLocation,
  VenueCandidate,
} from './provider.js';

const MAPBOX_SEARCH_URL = 'https://api.mapbox.com/search/searchbox/v1';
const MAPBOX_TIMEOUT_MS = 6_000;
const MAPBOX_RESULT_LIMIT = 10;
const MAX_REVERSE_DISTANCE_METERS = 250;
const EARTH_RADIUS_METERS = 6_371_000;

const coordinateSchema = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);

const boundsSchema = z
  .tuple([
    z.number().finite().min(-180).max(180),
    z.number().finite().min(-90).max(90),
    z.number().finite().min(-180).max(180),
    z.number().finite().min(-90).max(90),
  ])
  .refine(
    ([west, south, east, north]) => west < east && south < north,
    'Map bounds must be ordered',
  );

const contextNameSchema = z
  .object({
    name: z.string().optional(),
    country_code: z.string().optional(),
  })
  .passthrough();

const mapboxFeatureSchema = z
  .object({
    bbox: boundsSchema.optional(),
    geometry: z.object({ coordinates: coordinateSchema }),
    properties: z
      .object({
        mapbox_id: z.string().min(1),
        feature_type: z.string().min(1),
        name: z.string().min(1),
        full_address: z.string().optional(),
        place_formatted: z.string().optional(),
        bbox: boundsSchema.optional(),
        maki: z.string().optional(),
        poi_category: z.array(z.string()).optional(),
        poi_category_ids: z.array(z.string()).optional(),
        context: z
          .object({
            country: contextNameSchema.optional(),
            region: contextNameSchema.optional(),
            district: contextNameSchema.optional(),
            place: contextNameSchema.optional(),
            locality: contextNameSchema.optional(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

const mapboxCollectionSchema = z
  .object({ features: z.array(mapboxFeatureSchema) })
  .passthrough();

type MapboxFeature = z.infer<typeof mapboxFeatureSchema>;
type MapboxFetcher = (input: string, init?: RequestInit) => Promise<Response>;

const normalize = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

const featureCountry = (feature: MapboxFeature): string | undefined =>
  feature.properties.context.country?.country_code?.toUpperCase();

const cityNames = (input: MapProviderLocation): readonly string[] => [
  input.city.name,
  input.city.nameAr,
  input.city.slug.replaceAll('-', ' '),
];

const featureCityNames = (feature: MapboxFeature): readonly string[] =>
  [
    feature.properties.name,
    feature.properties.context.place?.name,
    feature.properties.context.locality?.name,
    feature.properties.context.district?.name,
  ].filter((value): value is string => value !== undefined);

const matchesCity = (
  feature: MapboxFeature,
  input: MapProviderLocation,
): boolean => {
  const expected = cityNames(input).map(normalize).filter(Boolean);
  return featureCityNames(feature)
    .map(normalize)
    .some((candidate) =>
      expected.some((name) => candidate === name || candidate.includes(name)),
    );
};

const isWithinBounds = (
  longitude: number,
  latitude: number,
  bounds: HostMapContext['bounds'],
): boolean =>
  longitude >= bounds[0] &&
  latitude >= bounds[1] &&
  longitude <= bounds[2] &&
  latitude <= bounds[3];

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

const distanceMeters = (
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
): number => {
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return (
    2 *
    EARTH_RADIUS_METERS *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
};

const supportedVenueTokens = new Set([
  'cafe',
  'coffee',
  'coffee shop',
  'coworking',
  'coworking space',
  'shared office',
  'business center',
  'business centre',
]);

const isSupportedVenue = (feature: MapboxFeature): boolean => {
  if (feature.properties.feature_type !== 'poi') return false;
  const categories = [
    feature.properties.maki,
    ...(feature.properties.poi_category ?? []),
    ...(feature.properties.poi_category_ids ?? []),
  ]
    .filter((value): value is string => value !== undefined)
    .map(normalize);
  return categories.some((category) => supportedVenueTokens.has(category));
};

const toVenue = (feature: MapboxFeature): VenueCandidate => {
  const [longitude, latitude] = feature.geometry.coordinates;
  const formatted = feature.properties.place_formatted;
  return {
    providerId: feature.properties.mapbox_id,
    name: feature.properties.name,
    address:
      feature.properties.full_address ??
      (formatted
        ? `${feature.properties.name}, ${formatted}`
        : feature.properties.name),
    latitude,
    longitude,
  };
};

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
      types: 'poi',
    });
    if (!result.ok) return result;
    return ok(
      result.data
        .filter((feature) => {
          const [longitude, latitude] = feature.geometry.coordinates;
          return (
            featureCountry(feature) === input.marketCode &&
            matchesCity(feature, input) &&
            isWithinBounds(longitude, latitude, bounds) &&
            isSupportedVenue(feature)
          );
        })
        .map(toVenue),
    );
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
      types: 'poi',
    });
    if (!result.ok) return result;
    const feature = result.data.find((candidate) => {
      const [longitude, latitude] = candidate.geometry.coordinates;
      return (
        featureCountry(candidate) === input.marketCode &&
        matchesCity(candidate, input) &&
        isSupportedVenue(candidate) &&
        distanceMeters(input, { latitude, longitude }) <=
          MAX_REVERSE_DISTANCE_METERS
      );
    });
    return feature
      ? ok(toVenue(feature))
      : err(
          new AppError(
            'map_venue_unsupported',
            'Select a supported café or coworking venue',
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
