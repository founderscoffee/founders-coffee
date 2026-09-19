import { describe, expect, it } from 'vitest';

import { routeMarketSlug } from './route-market';

describe('routeMarketSlug', () => {
  it('reads the market from the segment after the locale', () => {
    expect(routeMarketSlug({ market: 'en', city: 'egypt' })).toBe('egypt');
    expect(routeMarketSlug({ market: 'fr', city: 'algeria' })).toBe('algeria');
    expect(routeMarketSlug({ market: 'ar', city: 'saudi-arabia' })).toBe(
      'saudi-arabia',
    );
  });

  it('reads the first segment when no locale prefixes it', () => {
    expect(routeMarketSlug({ market: 'egypt' })).toBe('egypt');
  });

  it('names no market where the route names none', () => {
    expect(routeMarketSlug({ market: 'ar' })).toBeUndefined();
    expect(routeMarketSlug({})).toBeUndefined();
  });

  it('never answers with the locale itself', () => {
    expect(
      routeMarketSlug({ market: 'en', city: 'egypt' }),
      'returning the locale is what sent every page to the markets[0] fallback',
    ).not.toBe('en');
  });
});
