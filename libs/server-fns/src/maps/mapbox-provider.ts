import { AppError, err, ok, type Result } from '@founders-coffee/core';
import type { geo } from '@founders-coffee/domain';

import {
  distanceMeters,
  featureCountry,
  isAddressableLocation,
  isSupportedVenue,
  isWithinBounds,
  matchesCity,
  toAdmin,
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
  StoredPlace,
} from './provider.js';

const MAPBOX_SEARCH_URL = 'https://api.mapbox.com/search/searchbox/v1';
const MAPBOX_GEOCODE_URL = 'https://api.mapbox.com/search/geocode/v6';
const MAPBOX_TIMEOUT_MS = 6_000;
const MAPBOX_RESULT_LIMIT = 10;
const VENUE_TYPES = 'poi,address,street';
const CITY_LOOKUP_LANGUAGE = 'en';

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
    input: MapProviderLocation & { readonly city: geo.GeoCity },
  ): Promise<Result<{ feature: MapboxFeature; context: HostMapContext }>> => {
    const result = await fetchCollection('forward', {
      q: `${input.city.name}, ${input.marketCode}`,
      country: input.marketCode,
      language: CITY_LOOKUP_LANGUAGE,
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

  /**
   * The place at a point, in a form we are allowed to keep.
   *
   * Search Box data is licensed for temporary use only and has no permanent option, so nothing it
   * returns may be written to the database. Geocoding v6 does support `permanent=true`, and one
   * request carries everything a published event needs: an address to show, and the administrative
   * hierarchy that turns the pin into a state and a city for counting. It also answers where Search
   * Box does not — open desert included — which is why it is the publish-time lookup rather than a
   * fallback.
   */
  const describePoint: MapProvider['describePoint'] = async (input) => {
    const url = new URL(`${MAPBOX_GEOCODE_URL}/reverse`);
    const params: Record<string, string> = {
      longitude: String(input.longitude),
      latitude: String(input.latitude),
      types: 'address,street,place,region',
      language: input.locale,
      limit: '1',
      permanent: 'true',
      access_token: accessToken,
    };
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
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
      const features = parsed.data.features.filter(
        (feature) => featureCountry(feature) === input.marketCode,
      );
      const addressable = features.find(isAddressableLocation);
      const anyFeature = addressable ?? features[0];
      if (!anyFeature) {
        return err(
          new AppError(
            'map_venue_unsupported',
            'No place could be resolved for this point',
          ),
        );
      }
      const place: StoredPlace = {
        address:
          anyFeature.properties.full_address ?? anyFeature.properties.name,
        admin: toAdmin(anyFeature),
      };
      return ok(place);
    } catch {
      return mapboxFailure('Map provider request failed');
    }
  };

  const getCityViewport: MapProvider['getCityViewport'] = async (input) => {
    if (!input.city) {
      return err(
        new AppError('map_city_not_found', 'No city to resolve a viewport for'),
      );
    }
    const result = await resolveCity({ ...input, city: input.city });
    return result.ok ? ok(result.data.context) : result;
  };

  /**
   * Candidate venues inside the selected city.
   *
   * Without a city the search runs against the whole market, biased toward where the host is
   * looking. With one, membership is decided by the city's own bounding box, never by comparing the
   * provider's
   * place names: those are localized — `Algiers`, `Alger`, `الجزائر العاصمة` — and no string
   * comparison relates them, so a name filter silently emptied every result for a host reading
   * anything but English. Supported venues are ranked above bare addresses so a real café still
   * wins where the provider indexes one.
   */
  const searchVenues: MapProvider['searchVenues'] = async (input) => {
    const cityResult = input.city
      ? await resolveCity({ ...input, city: input.city })
      : null;
    if (cityResult && !cityResult.ok) return cityResult;
    const bounds = cityResult?.data.context.bounds;
    const proximity =
      input.proximity ??
      (cityResult
        ? {
            latitude: cityResult.data.context.center.latitude,
            longitude: cityResult.data.context.center.longitude,
          }
        : undefined);
    const result = await fetchCollection('forward', {
      q: input.query,
      ...(bounds ? { bbox: bounds.join(',') } : {}),
      ...(proximity
        ? { proximity: `${proximity.longitude},${proximity.latitude}` }
        : {}),
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
        (bounds ? isWithinBounds(longitude, latitude, bounds) : true) &&
        (isSupportedVenue(feature) || isAddressableLocation(feature))
      );
    });
    const supported = candidates.filter(isSupportedVenue);
    const addressable = candidates.filter(
      (feature) => !isSupportedVenue(feature),
    );
    return ok([...supported, ...addressable].map(toVenue));
  };

  /**
   * The venue at a point the host chose.
   *
   * The point is the location, so nothing constrains where it may be beyond the market itself.
   * A café or address within `MAX_REVERSE_DISTANCE_METERS` names the pin; failing that the nearest
   * addressable feature in the same country is offered as a bare address for the host to name
   * themselves. Rejecting the pin outright would be wrong now — the published address comes from
   * `describePoint`, not from this, so there is nothing left for a rejection to protect.
   */
  const reverseVenue: MapProvider['reverseVenue'] = async (input) => {
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
        distanceMeters(input, { latitude, longitude }) <=
          MAX_REVERSE_DISTANCE_METERS
      );
    });
    const feature =
      nearby.find(isSupportedVenue) ?? nearby.find(isAddressableLocation);
    if (feature) return ok(toVenue(feature));

    const furtherAway = result.data.find(
      (candidate) =>
        featureCountry(candidate) === input.marketCode &&
        isAddressableLocation(candidate),
    );
    return furtherAway
      ? ok({ ...toVenue(furtherAway), kind: 'address' as const })
      : err(
          new AppError(
            'map_venue_unsupported',
            'No address could be resolved near this point',
          ),
        );
  };

  return {
    name: 'mapbox',
    getCityViewport,
    searchVenues,
    reverseVenue,
    describePoint,
  };
};
