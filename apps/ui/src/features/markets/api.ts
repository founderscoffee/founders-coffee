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

/**
 * Best-effort market slug for this visitor, or `null` when none can be established.
 *
 * `/` renders nothing; its whole job is to send a visitor on to a market, so geo detection is an
 * optimisation over the caller's default and nothing here may be what stops the redirect. Every
 * failure resolves to `null` instead of escaping.
 *
 * Both calls are server functions, and on the client a server function whose request fails — 429,
 * 503, an offline moment — resolves to `undefined` rather than rejecting. Reading `market` off that
 * threw `Cannot destructure property 'market' of '(intermediate value)'`, which is the error page a
 * visitor got from the header brand link whenever one of these two requests did not come back.
 */
export const geoMarketSlug = async (
  remembered: string | undefined,
): Promise<string | null> => {
  try {
    const key = remembered ?? (await getGeoCountry());
    if (!key) return null;
    const landing = await getMarketLanding({ data: { key } });
    return landing?.market.slug ?? null;
  } catch {
    return null;
  }
};

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
 * The cache is deliberately client-only. One Worker isolate serves many requests, so a
 * module-level promise on the server would hand the first visitor's list to everyone who followed
 * and would never refresh. A rejected fetch is never kept, so a failed call retries next time
 * instead of pinning the failure for the rest of the session.
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
