import { geo, venues } from '@founders-coffee/domain';

type Point = { latitude: number; longitude: number };

/** Whether a located point sits inside the selected city's map bounds. */
export const isInsideCity = (
  bounds: readonly [number, number, number, number],
  point: Point,
): boolean => venues.containsPoint(bounds, point);

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
