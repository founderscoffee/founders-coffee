import { isAppleMobile } from './apple-mobile';
import { formatCoordinate, type MapPoint } from './map-point';

export type MapsApp = 'apple' | 'google';

/**
 * The maps app a visitor most likely has: Apple Maps on an iPhone or iPad, where it is built in, and
 * Google Maps everywhere else, where its address opens the app on Android and the site elsewhere.
 */
export const mapsAppFor = (userAgent: string): MapsApp =>
  isAppleMobile(userAgent) ? 'apple' : 'google';

/**
 * The address that opens directions to `point` in `app`, from wherever the visitor is.
 *
 * Both are the apps' own documented web addresses, which a phone hands to the installed app, so no
 * app-specific scheme is needed. The destination is the point the host placed on the map, not the
 * venue's name, which the apps would search for and could match to somewhere else.
 */
export const directionsUrl = (app: MapsApp, point: MapPoint): string => {
  const destination = `${formatCoordinate(point.latitude)},${formatCoordinate(point.longitude)}`;
  return app === 'apple'
    ? `https://maps.apple.com/?${new URLSearchParams({ daddr: destination })}`
    : `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', destination })}`;
};
