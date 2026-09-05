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
export { SNAPSHOT_PROVIDER_PREFIX } from './types.js';

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
