import { geo, venues } from '@founders-coffee/domain';

type Point = { latitude: number; longitude: number };

/** The state a city belongs to, for showing the host where their event will be counted. */
export const stateForCity = (
  marketCode: string,
  city: geo.GeoCity,
): geo.GeoState | null => geo.findState(marketCode, city.stateCode) ?? null;

/**
 * The snapshotted city a located point belongs to, or null when we cannot say.
 *
 * Used to offer a host in the wrong city the right one, rather than clamping the camera to the
 * edge of a city they are not in and saying nothing.
 */
export const cityForPoint = (
  marketCode: string,
  point: Point,
): geo.GeoCity | null => {
  const found = venues.findCityByPoint(marketCode, point);
  return found ? (geo.findCity(marketCode, found.cityCode) ?? null) : null;
};
