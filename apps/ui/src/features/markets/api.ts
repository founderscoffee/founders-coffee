import {
  getCityLanding,
  getGeoCountry,
  getMarketLanding,
  getVisibleMarkets,
  type MarketCity,
  type MarketWithCities,
} from '@founders-coffee/server-fns';

import type { Market } from '@founders-coffee/db';

export const marketsApi = {
  getVisibleMarkets,
  getMarketLanding,
  getCityLanding,
};

type KnownMarket = Pick<Market, 'code' | 'slug'>;

/**
 * The listed market of the country this visitor is browsing from, or `null` when there is none.
 *
 * `/` renders nothing; its whole job is to send a visitor on to a market, so geo detection is an
 * optimisation over the caller's default and nothing here may be what stops the redirect. Every
 * failure resolves to `null` instead of escaping.
 *
 * The country is matched against the markets the root route already holds, whose codes are the
 * countries' own. Asking `getMarketLanding` instead looked the code up as a slug, then as a code,
 * then loaded a whole landing page to read one slug off it: up to five trips to D1 in a row before
 * the redirect, which the page it led to then repeated (#136).
 *
 * `getGeoCountry` is a server function, and on the client a server function whose request fails —
 * 429, 503, an offline moment — resolves to `undefined` rather than rejecting. Reading a property
 * off such an answer is what once turned the header brand link into the error page.
 */
export const geoMarketSlug = async (
  known: readonly KnownMarket[],
): Promise<string | null> => {
  try {
    const country = await getGeoCountry();
    if (!country) return null;
    const code = country.toUpperCase();
    return known.find((market) => market.code === code)?.slug ?? null;
  } catch {
    return null;
  }
};

/**
 * The market `/` should send this visitor to, preferring whatever is already in hand.
 *
 * The root route has the visible markets in context by the time this runs, and the `fc_geo` cookie
 * holds a slug this application wrote itself on the visitor's last redirect. While the list still
 * names that slug the answer needs no server at all.
 *
 * Otherwise the visitor's country decides, on a first visit and when the cookie names a market
 * that has since closed. That visitor usually arrives by SSR, where reading `cf-ipcountry` is a
 * header lookup on a request already in flight rather than a fetch.
 */
export const homeMarketSlug = async (
  known: readonly KnownMarket[],
  remembered: string | undefined,
): Promise<string | null> => {
  if (
    remembered !== undefined &&
    known.some((market) => market.slug === remembered)
  )
    return remembered;
  return geoMarketSlug(known);
};

export const GEO_COOKIE = 'fc_geo';

export const DEFAULT_MARKET_SLUG = 'algeria';

/**
 * The market an arrival that names no city should land on.
 *
 * `/` and `/fr` are the same arrival, one of them naming a language, so they have to choose the
 * same market. They did not: `/` asked `homeMarketSlug` while `/fr` sent everyone to Algeria, and
 * nothing showed it up while Algeria was the only place anyone arrived from. Pointing the installed
 * app at `/fr` is what would have made it visible, by routing every launch through the branch that
 * ignores where the visitor is.
 */
export const landingMarketSlug = async (
  known: readonly KnownMarket[],
  remembered: string | undefined,
): Promise<string> =>
  (await homeMarketSlug(known, remembered)) ?? DEFAULT_MARKET_SLUG;

let clientMarkets: Promise<readonly Market[]> | null = null;

const fetchVisibleMarkets = async (): Promise<readonly Market[]> =>
  (await getVisibleMarkets()) ?? [];

/**
 * The visible markets, fetched once per browser session.
 *
 * `__root.tsx` needs this list on every navigation, and the router re-runs the root `beforeLoad`
 * for each preload as well as each navigation, so an uncached call here was the largest single
 * source of server-function traffic: hovering the header was enough to re-request every market,
 * and the resulting volume is what pushed real visitors into the rate limiter that then broke
 * their navigation. The list only changes when an operator activates a market, so one fetch per
 * browser session is an acceptable staleness window and a reload picks up the change.
 *
 * This promise is deliberately client-only. One Worker isolate serves many requests, so a
 * module-level promise on the server would hand the first visitor's list to everyone who followed
 * and would never refresh. On the server the list comes from the copy each data centre keeps for
 * five minutes, behind the server function (#114). A rejected fetch is never kept, so a failed call
 * retries next time instead of pinning the failure for the rest of the session.
 */
export const visibleMarkets = async (): Promise<readonly Market[]> => {
  if (typeof window === 'undefined') return fetchVisibleMarkets();
  clientMarkets ??= fetchVisibleMarkets().catch((error: unknown) => {
    clientMarkets = null;
    throw error;
  });
  return clientMarkets;
};

export type RootMarket = Pick<
  Market,
  'code' | 'slug' | 'name' | 'nameAr' | 'nameFr' | 'timezone'
>;

/**
 * Narrows a market row to the fields the root route puts in every page's router context.
 *
 * The narrowing is deliberate — feature flags, brand overrides and currency have no business
 * being serialised into the HTML of every page — but it is a contract, not a convenience:
 * anything the shell or a context-driven page reads has to be here. `timezone` is the one with
 * teeth. Without it `EventCard` formats with `timeZone: undefined`, which resolves to UTC on the
 * Worker and to the visitor's own zone in the browser, so a market an hour off UTC renders the
 * wrong time in the server HTML and then silently corrects itself after hydration. The public
 * profile shipped that way. The return annotation is what makes dropping a field a typecheck
 * failure rather than a wrong clock.
 */
export const toRootMarket = (market: Market): RootMarket => ({
  code: market.code,
  slug: market.slug,
  name: market.name,
  nameAr: market.nameAr,
  nameFr: market.nameFr,
  timezone: market.timezone,
});

export type { MarketCity, MarketWithCities };
export type { Market };
