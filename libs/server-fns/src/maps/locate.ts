import { AppError, err, ok, type Result } from '@founders-coffee/core';
import { geo, venues as venuesDomain } from '@founders-coffee/domain';

import type { MapLocale } from './types.js';
import type { MapProvider, VenueAdmin } from './provider.js';

export interface LocatedPoint {
  readonly stateCode: string;
  readonly cityCode: string;
  readonly address: string;
}

export interface LocateInput {
  readonly marketCode: string;
  readonly locale: MapLocale;
  readonly latitude: number;
  readonly longitude: number;
  readonly snapshotProviderId?: string;
  readonly fallbackAddress?: string;
}

const normalize = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/**
 * The city a provider place name refers to, searched only within its own state.
 *
 * Matching a place name against every city in a market is the trap `matchesCity` warns about —
 * names are localized and repeat across regions. Narrowed to one state the candidate set is small
 * enough that an exact normalized match is reliable, and a miss simply falls through.
 */
const cityInState = (
  marketCode: string,
  stateCode: string,
  placeName: string | undefined,
): string | undefined => {
  if (!placeName) return undefined;
  const wanted = normalize(placeName);
  if (wanted === '') return undefined;
  const city = geo
    .getCities(marketCode, stateCode)
    .find(
      (candidate) =>
        normalize(candidate.name) === wanted ||
        normalize(candidate.nameAr) === wanted ||
        (candidate.nameFr !== undefined &&
          normalize(candidate.nameFr) === wanted),
    );
  return city?.code;
};

const fromAdmin = (
  marketCode: string,
  admin: VenueAdmin | undefined,
  point: { latitude: number; longitude: number },
): { stateCode: string; cityCode: string } | undefined => {
  const stateCode = admin?.isoRegionCode
    ? geo.stateCodeForIso(marketCode, admin.isoRegionCode)
    : undefined;
  if (!stateCode) return undefined;
  const named = cityInState(marketCode, stateCode, admin?.placeName);
  if (named) return { stateCode, cityCode: named };
  const nearest = venuesDomain.findCityByPoint(marketCode, point);
  const nearestCity = nearest
    ? geo.findCity(marketCode, nearest.cityCode)
    : undefined;
  return nearestCity?.stateCode === stateCode
    ? { stateCode, cityCode: nearestCity.code }
    : undefined;
};

/**
 * Where an event is, derived from the point the host chose.
 *
 * A venue taken from our own OpenStreetMap snapshot answers without any provider call at all: the
 * snapshot is keyed by city, and its name and address are ODbL data we may store. Anything else —
 * a dropped pin, a search result — is resolved once through Geocoding v6, which is the only lookup
 * here whose results we are licensed to keep, and which answers everywhere including open desert.
 *
 * `state_code` and `city_code` are both NOT NULL, so this either produces a complete pair or fails
 * loudly. It never guesses a state it cannot name.
 */
export const locatePoint = async (
  provider: MapProvider,
  input: LocateInput,
): Promise<Result<LocatedPoint>> => {
  const point = { latitude: input.latitude, longitude: input.longitude };

  if (input.snapshotProviderId) {
    const found = venuesDomain.findSnapshotVenueInMarket(
      input.marketCode,
      input.snapshotProviderId,
      point,
    );
    const city = found
      ? geo.findCity(input.marketCode, found.cityCode)
      : undefined;
    if (found && city) {
      return ok({
        stateCode: city.stateCode,
        cityCode: city.code,
        address: found.venue.address,
      });
    }
  }

  const described = await provider.describePoint({
    marketCode: input.marketCode,
    locale: input.locale,
    latitude: input.latitude,
    longitude: input.longitude,
  });
  if (!described.ok) return described;

  const resolved = fromAdmin(input.marketCode, described.data.admin, point);
  if (!resolved) {
    return err(
      new AppError(
        'map_venue_unsupported',
        'Could not place this point in a known state',
      ),
    );
  }

  return ok({
    stateCode: resolved.stateCode,
    cityCode: resolved.cityCode,
    address: described.data.address || (input.fallbackAddress ?? ''),
  });
};
