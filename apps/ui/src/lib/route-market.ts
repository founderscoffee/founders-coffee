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
