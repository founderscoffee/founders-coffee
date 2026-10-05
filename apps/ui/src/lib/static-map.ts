import { formatCoordinate, type MapPoint } from './map-point';

const STYLE = 'mapbox/satellite-streets-v12';

const ZOOM = 14.5;

type MapBox = {
  readonly width: number;
  readonly height: number;
};

const SCREENS: readonly (MapBox & { readonly media: string })[] = [
  { media: '(min-width: 64rem)', width: 960, height: 288 },
  { media: '(min-width: 48rem)', width: 960, height: 256 },
  { media: '(min-width: 40rem)', width: 736, height: 256 },
  { media: '(min-width: 27rem)', width: 608, height: 224 },
];

const PHONE: MapBox = { width: 400, height: 224 };

export type StaticMapSource = {
  readonly media: string;
  readonly srcSet: string;
};

export type StaticMapPicture = {
  readonly sources: readonly StaticMapSource[];
  readonly src: string;
  readonly srcSet: string;
};

export const STATIC_MAP_ORIGIN = 'https://api.mapbox.com';

export type StaticMapCredit = {
  readonly label: string;
  readonly href: string;
};

export const STATIC_MAP_CREDITS: readonly StaticMapCredit[] = [
  { label: '© Mapbox', href: 'https://www.mapbox.com/about/maps' },
  { label: '© OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' },
  { label: '© Maxar', href: 'https://www.maxar.com/' },
];

export const MAP_FEEDBACK_URL = 'https://apps.mapbox.com/feedback/';

/**
 * Mapbox's satellite picture of the area around `point`, `box` CSS pixels at `density` device pixels
 * each, centred on the point so a pin drawn over the middle of it marks the place.
 *
 * The picture comes without Mapbox's logo and credits, which it would print in its bottom corners:
 * the page crops the picture's sides on most phones, a 320px one loses 56px on each, and the logo
 * and credits went with them. Mapbox asks a static map on a web page for its credits as a line of
 * links near the picture and for its logo on the map, so `EventLocationMap` draws both: the logo
 * in a corner of the box it shows, and `STATIC_MAP_CREDITS` and `MAP_FEEDBACK_URL` below it. Maxar
 * is credited because the style is satellite imagery.
 */
export const staticMapUrl = (
  point: MapPoint,
  box: MapBox,
  density: 1 | 2,
  token: string,
): string =>
  `${STATIC_MAP_ORIGIN}/styles/v1/${STYLE}/static/${formatCoordinate(point.longitude)},${formatCoordinate(point.latitude)},${ZOOM}/${box.width}x${box.height}${density === 2 ? '@2x' : ''}?attribution=false&logo=false&access_token=${encodeURIComponent(token)}`;

const srcSetFor = (point: MapPoint, box: MapBox, token: string): string =>
  `${staticMapUrl(point, box, 1, token)} 1x, ${staticMapUrl(point, box, 2, token)} 2x`;

/**
 * The meetup page's map as one picture per height the page gives it, for a `<picture>` element.
 *
 * The page drew a live Mapbox map that nobody could move: on 2026-10-05, on staging, under a phone
 * profile (CPU slowed four times, slow 4G, an empty cache), it cost 1.4 to 2 MB in 34 to 51 requests,
 * drew 3.3 to 4.9 s after the page opened and held the main thread for 0.3 to 2.7 s. Mapbox's
 * picture of a phone's box is one request of about 130 KB, which the browser starts from the page's
 * HTML. The live map stays where a host picks a place.
 *
 * The boxes follow the map's classes in `EventLocationMap` (`h-56 sm:h-64 lg:h-72`, the width of
 * `max-w-5xl` less its padding). Each picture is as tall as its box and at least as wide, so the
 * page crops the sides and never scales the map. A phone's picture is 400 wide, the box of a 432px
 * screen; wider screens up to 640 take one 608 wide. The style is the classic satellite one
 * because Mapbox's static renderer drew the live map's Standard Satellite as a black image.
 */
export const staticMapPicture = (
  point: MapPoint,
  token: string,
): StaticMapPicture => ({
  sources: SCREENS.map(({ media, ...box }) => ({
    media,
    srcSet: srcSetFor(point, box, token),
  })),
  src: staticMapUrl(point, PHONE, 2, token),
  srcSet: srcSetFor(point, PHONE, token),
});

/**
 * The links for the head of a page that shows Mapbox's picture of `place`: a connection to Mapbox's
 * API, opened before the page reaches its `<picture>`, or none when the page shows no picture for
 * want of a place or a token.
 *
 * The picture is the largest thing on the meetup page's first screen, on a 360 and a 390px phone
 * and on a 1280px desktop (2026-10-05), so it is the page's largest contentful paint, and on a
 * first visit its request also waits for a connection to a server the page has not used yet: DNS,
 * TCP and TLS, up to three round trips, about 450 ms on slow 4G. TanStack Start lists the link in
 * the response's Link header too, which Cloudflare sends later readers of the page as an Early
 * Hint, before the Worker has rendered anything (`isCacheSafeEarlyHint` lets it through). It
 * carries no `crossorigin`: the picture is fetched without CORS, and a browser keeps the
 * connections for the two apart.
 */
export const staticMapHeadLinks = (
  place: {
    readonly latitude: number | null;
    readonly longitude: number | null;
  },
  token: string | null,
): readonly { readonly rel: 'preconnect'; readonly href: string }[] =>
  place.latitude != null && place.longitude != null && token
    ? [{ rel: 'preconnect', href: STATIC_MAP_ORIGIN }]
    : [];
