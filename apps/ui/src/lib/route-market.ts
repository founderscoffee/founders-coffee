/**
 * Whether a market route is the page being rendered, rather than a parent of a city route.
 *
 * `/$locale/$market` matches `/en/algeria`, and its loader also runs for `/en/algeria/algiers`,
 * where the city route below it is what the reader asked for. Anything the market loader does
 * unconditionally therefore happens on city pages too: sending a stale cursor back to the clean
 * URL from here would answer a city request with the market page and drop the city.
 *
 * The depth is fixed at two because the prefix is no longer optional. `/algeria/algiers` is
 * answered by the layout with `/ar/algeria/algiers` before any loader beneath it runs, so a path
 * that reaches this function has a language in front of it.
 */
export const isMarketLeaf = (pathname: string): boolean =>
  pathname.split('/').filter(Boolean).length <= 2;
