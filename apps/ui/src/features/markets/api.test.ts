import { beforeEach, describe, expect, it, vi } from 'vitest';

const getGeoCountry = vi.fn();
const getMarketLanding = vi.fn();
const getVisibleMarkets = vi.fn();

vi.mock('@founders-coffee/server-fns', () => ({
  getCityLanding: vi.fn(),
  getVisibleMarkets: () => getVisibleMarkets(),
  getGeoCountry: () => getGeoCountry(),
  getMarketLanding: (args: unknown) => getMarketLanding(args),
}));

const { geoMarketSlug } = await import('./api');

const freshApi = async () => {
  vi.resetModules();
  return import('./api');
};

beforeEach(() => {
  getGeoCountry.mockReset();
  getMarketLanding.mockReset();
  getVisibleMarkets.mockReset();
});

describe('geoMarketSlug', () => {
  it('resolves the market the visitor is browsing from', async () => {
    getGeoCountry.mockResolvedValue('DZ');
    getMarketLanding.mockResolvedValue({ market: { slug: 'algeria' } });

    await expect(geoMarketSlug(undefined)).resolves.toBe('algeria');
    expect(getMarketLanding).toHaveBeenCalledWith({ data: { key: 'DZ' } });
  });

  it('trusts a remembered market rather than asking for geo again', async () => {
    getMarketLanding.mockResolvedValue({ market: { slug: 'tunisia' } });

    await expect(geoMarketSlug('tunisia')).resolves.toBe('tunisia');
    expect(getGeoCountry).not.toHaveBeenCalled();
  });

  it('gives up quietly when a request comes back with nothing', async () => {
    getGeoCountry.mockResolvedValue('DZ');
    getMarketLanding.mockResolvedValue(undefined);

    await expect(
      geoMarketSlug(undefined),
      'a rate-limited or failed server function resolves to undefined on the client, and reading market off it turns the site root into the error page',
    ).resolves.toBeNull();
  });

  it('gives up quietly when geo cannot be reached', async () => {
    getGeoCountry.mockRejectedValue(new Error('offline'));

    await expect(geoMarketSlug(undefined)).resolves.toBeNull();
  });

  it('gives up quietly when the market lookup rejects', async () => {
    getGeoCountry.mockResolvedValue('FR');
    getMarketLanding.mockRejectedValue(new Error('market_not_found'));

    await expect(geoMarketSlug(undefined)).resolves.toBeNull();
  });

  it('asks for no market when geo says nothing', async () => {
    getGeoCountry.mockResolvedValue(null);

    await expect(geoMarketSlug(undefined)).resolves.toBeNull();
    expect(getMarketLanding).not.toHaveBeenCalled();
  });
});

describe('visibleMarkets', () => {
  it('asks the server once however many navigations follow', async () => {
    getVisibleMarkets.mockResolvedValue([{ slug: 'algeria' }]);
    const { visibleMarkets } = await freshApi();

    await visibleMarkets();
    await visibleMarkets();
    await visibleMarkets();

    expect(
      getVisibleMarkets,
      'the router re-runs the root beforeLoad for every navigation and every preload, so an uncached list is what put real visitors into the rate limiter',
    ).toHaveBeenCalledTimes(1);
  });

  it('retries after a failed fetch rather than pinning it for the session', async () => {
    getVisibleMarkets.mockRejectedValueOnce(new Error('rate limited'));
    getVisibleMarkets.mockResolvedValue([{ slug: 'algeria' }]);
    const { visibleMarkets } = await freshApi();

    await expect(visibleMarkets()).rejects.toThrow('rate limited');

    await expect(
      visibleMarkets(),
      'caching the rejected promise would leave the footer and market switcher empty until a reload',
    ).resolves.toEqual([{ slug: 'algeria' }]);
  });

  it('treats an empty answer as no markets rather than undefined', async () => {
    getVisibleMarkets.mockResolvedValue(undefined);
    const { visibleMarkets } = await freshApi();

    await expect(visibleMarkets()).resolves.toEqual([]);
  });
});
