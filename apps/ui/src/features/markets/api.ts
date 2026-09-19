import {
  getCityLanding,
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
