import type {
  HostMapContext,
  MapProviderLocation,
  VenueCandidate,
  VenueKind,
} from './provider.js';
import type { MapboxFeature } from './mapbox-schemas.js';

export const MAX_REVERSE_DISTANCE_METERS = 250;
const EARTH_RADIUS_METERS = 6_371_000;

const normalize = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

export const featureCountry = (feature: MapboxFeature): string | undefined =>
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

export const matchesCity = (
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

export const isWithinBounds = (
  longitude: number,
  latitude: number,
  bounds: HostMapContext['bounds'],
): boolean =>
  longitude >= bounds[0] &&
  latitude >= bounds[1] &&
  longitude <= bounds[2] &&
  latitude <= bounds[3];

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const distanceMeters = (
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

export const isSupportedVenue = (feature: MapboxFeature): boolean => {
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

const ADDRESSABLE_FEATURE_TYPES = new Set(['address', 'street']);

/**
 * Whether a feature locates a real, navigable spot even though it names no business.
 *
 * Mapbox indexes no points of interest across the Maghreb: a reverse lookup anywhere in Algiers
 * returns a street or an address and never a café, so a POI-only rule makes event creation
 * impossible in the launch market rather than merely strict. An address still carries everything an
 * attendee needs to arrive — a verified street, inside the selected city, with coordinates — so it
 * is accepted as a location whose *label* the host supplies, while a POI keeps naming itself.
 */
export const isAddressableLocation = (feature: MapboxFeature): boolean =>
  ADDRESSABLE_FEATURE_TYPES.has(feature.properties.feature_type);

export const venueKind = (feature: MapboxFeature): VenueKind =>
  isSupportedVenue(feature) ? 'poi' : 'address';

export const toVenue = (feature: MapboxFeature): VenueCandidate => {
  const [longitude, latitude] = feature.geometry.coordinates;
  const formatted = feature.properties.place_formatted;
  return {
    providerId: feature.properties.mapbox_id,
    kind: venueKind(feature),
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
