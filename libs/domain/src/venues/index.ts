import { DZ_CITY_VENUES } from './data/dz.js';
import { EG_CITY_VENUES } from './data/eg.js';
import { SA_CITY_VENUES } from './data/sa.js';
import {
  metresBetween,
  SNAPSHOT_PROVIDER_PREFIX,
  type CityVenueSnapshot,
  type SnapshotVenue,
} from './types.js';

export type {
  CityVenueSnapshot,
  SnapshotVenue,
  VenueCategory,
} from './types.js';
export {
  SNAPSHOT_PROVIDER_PREFIX,
  VENUE_CATEGORIES,
  venueCategorySchema,
} from './types.js';

const SNAPSHOTS: Readonly<Record<string, Record<string, CityVenueSnapshot>>> = {
  DZ: DZ_CITY_VENUES,
  EG: EG_CITY_VENUES,
  SA: SA_CITY_VENUES,
};

const COORDINATE_TOLERANCE_METRES = 50;

/**
 * The snapshotted venues for a city, or an empty list where none were collected.
 *
 * Only featured cities are snapshotted, so an unlisted city is expected rather than exceptional:
 * the wizard falls back to search and tapping the map, which is what it did everywhere before.
 */
export const getCityVenues = (
  marketCode: string,
  cityCode: string,
): readonly SnapshotVenue[] => SNAPSHOTS[marketCode]?.[cityCode]?.venues ?? [];

/**
 * The stored viewport for a city, used to centre the map without asking the map provider.
 */
export const getCityViewportSnapshot = (
  marketCode: string,
  cityCode: string,
): Pick<CityVenueSnapshot, 'center' | 'bounds'> | null => {
  const snapshot = SNAPSHOTS[marketCode]?.[cityCode];
  return snapshot ? { center: snapshot.center, bounds: snapshot.bounds } : null;
};

/** Whether a point falls inside a `[west, south, east, north]` box. */
export const containsPoint = (
  bounds: readonly [number, number, number, number],
  point: { latitude: number; longitude: number },
): boolean =>
  point.longitude >= bounds[0] &&
  point.longitude <= bounds[2] &&
  point.latitude >= bounds[1] &&
  point.latitude <= bounds[3];

const NEAREST_CITY_LIMIT_METRES = 40_000;

/**
 * The snapshotted city a point falls in, for a host whose selected city is not where they are.
 *
 * Stored bounds are administrative and overlap, so containment alone can match several cities;
 * the nearest centre among them wins. A point in no city's bounds still resolves if a centre is
 * within 40km, which covers a suburb the snapshot did not draw around — beyond that the honest
 * answer is that we do not know, and the caller says so rather than guessing a city.
 */
export const findCityByPoint = (
  marketCode: string,
  point: { latitude: number; longitude: number },
): { cityCode: string } | null => {
  const cities = Object.values(SNAPSHOTS[marketCode] ?? {});
  if (cities.length === 0) return null;
  const ranked = cities
    .map((city) => ({
      city,
      inside: containsPoint(city.bounds, point),
      distance: metresBetween(city.center, point),
    }))
    .sort((a, b) =>
      a.inside === b.inside ? a.distance - b.distance : a.inside ? -1 : 1,
    );
  const best = ranked[0];
  return best.inside || best.distance <= NEAREST_CITY_LIMIT_METRES
    ? { cityCode: best.city.cityCode }
    : null;
};

/**
 * The map viewport for a whole market, as the union of its snapshotted city bounds.
 *
 * Opening the wizard no longer requires a city, so the map needs somewhere to start. Deriving it
 * from data we already ship avoids a geocode per page view, and it is tight around where events
 * can plausibly happen rather than the country's full administrative extent — which for Algeria
 * would be two thirds desert.
 */
export const getMarketViewport = (
  marketCode: string,
): {
  center: { latitude: number; longitude: number };
  bounds: readonly [number, number, number, number];
} | null => {
  const cities = Object.values(SNAPSHOTS[marketCode] ?? {});
  if (cities.length === 0) return null;
  const bounds = cities.reduce<[number, number, number, number]>(
    (acc, city) => [
      Math.min(acc[0], city.bounds[0]),
      Math.min(acc[1], city.bounds[1]),
      Math.max(acc[2], city.bounds[2]),
      Math.max(acc[3], city.bounds[3]),
    ],
    [...cities[0].bounds] as [number, number, number, number],
  );
  return {
    center: {
      longitude: (bounds[0] + bounds[2]) / 2,
      latitude: (bounds[1] + bounds[3]) / 2,
    },
    bounds,
  };
};

/**
 * Snapshotted venues nearest a point, across the whole market.
 *
 * Keyed by distance rather than by city because the host no longer picks a city first: the list
 * follows wherever the map is looking, and a point near a boundary surfaces venues from both sides,
 * which is the honest answer.
 */
export const findVenuesNearPoint = (
  marketCode: string,
  point: { latitude: number; longitude: number },
  radiusMetres: number,
  limit: number,
): readonly SnapshotVenue[] =>
  Object.values(SNAPSHOTS[marketCode] ?? {})
    .flatMap((city) => city.venues)
    .map((venue) => ({ venue, distance: metresBetween(venue, point) }))
    .filter((entry) => entry.distance <= radiusMetres)
    .sort((a, b) =>
      a.venue.eligible === b.venue.eligible
        ? a.distance - b.distance
        : a.venue.eligible
          ? -1
          : 1,
    )
    .slice(0, limit)
    .map((entry) => entry.venue);

export const isSnapshotProviderId = (providerId: string): boolean =>
  providerId.startsWith(SNAPSHOT_PROVIDER_PREFIX);

/**
 * Match a submitted venue back to the snapshot it claims to come from.
 *
 * Publishing re-verifies every venue through the map provider, which is correct for a point the
 * host dropped on the map but wrong for one of ours: the provider indexes almost no cafés in
 * Algiers or Cairo, so re-checking would either reject the venue or overwrite its name and address
 * with a bare street. A snapshot venue is trusted only when its id resolves and the submitted
 * coordinates still sit on top of the stored ones, so a client cannot borrow an id to publish
 * somewhere else.
 */
export const matchSnapshotVenue = (
  venues: readonly SnapshotVenue[],
  providerId: string,
  coordinates: { latitude: number; longitude: number },
): SnapshotVenue | null => {
  if (!isSnapshotProviderId(providerId)) return null;
  const venue = venues.find((candidate) => candidate.providerId === providerId);
  if (!venue || !venue.eligible) return null;
  return metresBetween(venue, coordinates) <= COORDINATE_TOLERANCE_METRES
    ? venue
    : null;
};

/**
 * Find a snapshot venue anywhere in the market, and say which city it belongs to.
 *
 * The city-scoped lookup below assumes the host chose a city first. Once the map point is the
 * truth there is no city to scope by, so the id is matched across the market and the city falls
 * out of where the venue was found.
 */
export const findSnapshotVenueInMarket = (
  marketCode: string,
  providerId: string,
  coordinates: { latitude: number; longitude: number },
): { venue: SnapshotVenue; cityCode: string } | null => {
  if (!isSnapshotProviderId(providerId)) return null;
  for (const [cityCode, snapshot] of Object.entries(
    SNAPSHOTS[marketCode] ?? {},
  )) {
    const venue = matchSnapshotVenue(snapshot.venues, providerId, coordinates);
    if (venue) return { venue, cityCode };
  }
  return null;
};

export const findSnapshotVenue = (
  marketCode: string,
  cityCode: string,
  providerId: string,
  coordinates: { latitude: number; longitude: number },
): SnapshotVenue | null =>
  matchSnapshotVenue(
    getCityVenues(marketCode, cityCode),
    providerId,
    coordinates,
  );
