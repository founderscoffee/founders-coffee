import { isLocale } from '@founders-coffee/i18n';

/**
 * The market slug a route's params carry, or undefined where the route names no market.
 *
 * The locale prefix occupies the first path segment and the route tree calls that segment
 * `$market`, so on a localized URL every param is shifted by one: `/en/egypt` parses as
 * `{ market: 'en', city: 'egypt' }`, and `/fr/algeria/algiers` as
 * `{ market: 'fr', city: 'algeria', subcity: 'algiers' }`. `$market/index.tsx` and
 * `$market.$city.tsx` both already read the params this way, by testing `isLocale(params.market)`
 * first.
 *
 * The root route did not, and matched a market slug against `params.market` — which is a locale on
 * every localized URL and so matched nothing, sending every page to the `markets[0]` fallback. The
 * whole site told its readers they were in Algeria: `/en/egypt` rendered "Meet founders and
 * investors in Algeria", and the navbar's market links pointed there too.
 */
export const routeMarketSlug = (params: {
  readonly market?: string;
  readonly city?: string;
}): string | undefined =>
  isLocale(params.market) ? params.city : params.market;

/**
 * Whether a market route is the page being rendered, rather than a parent of a city route.
 *
 * `/$market/$city` matches `/en/algeria`, and its loader also runs for `/en/algeria/algiers`,
 * where the city route below it is what the reader asked for. Anything the market loader does
 * unconditionally therefore happens on city pages too: sending a stale cursor back to the clean
 * URL from here would answer a city request with the market page and drop the city.
 *
 * The depth to compare against is not fixed, because the locale prefix is optional: the market
 * sits at segment two under `/en/algeria` and at segment one under `/algeria`. Counting to a
 * constant reads the unprefixed city path as a market page.
 */
export const isMarketLeaf = (pathname: string): boolean => {
  const segments = pathname.split('/').filter(Boolean);
  return segments.length <= (isLocale(segments[0]) ? 2 : 1);
};
