import {
  getCityLanding,
  getMarketLanding,
  getVisibleMarkets,
  type MarketCity,
  type MarketWithCities,
} from '@founders-coffee/server-fns';

export const marketsApi = {
  getVisibleMarkets,
  getMarketLanding,
  getCityLanding,
};

export type { MarketCity, MarketWithCities };
