import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const { geoMarketSlug, homeMarketSlug, landingMarketSlug } =
  await import('./api');

const freshApi = async () => {
  vi.resetModules();
  return import('./api');
};

beforeEach(() => {
  getGeoCountry.mockReset();
  getMarketLanding.mockReset();
  getVisibleMarkets.mockReset();
});

const LISTED = [
  { code: 'DZ', slug: 'algeria' },
  { code: 'EG', slug: 'egypt' },
  { code: 'SA', slug: 'saudi-arabia' },
];

describe('geoMarketSlug', () => {
  it('finds the market of the country the visitor is browsing from in the list already held', async () => {
    getGeoCountry.mockResolvedValue('EG');

    await expect(geoMarketSlug(LISTED)).resolves.toBe('egypt');
    expect(
      getMarketLanding,
      'loading a whole landing to read its market slug put up to five trips to D1 in front of the redirect (#136)',
    ).not.toHaveBeenCalled();
  });

  it('reads a country code in either case, as DEV_GEO may be written', async () => {
    getGeoCountry.mockResolvedValue('sa');

    await expect(geoMarketSlug(LISTED)).resolves.toBe('saudi-arabia');
  });

  it('names no market for a country none is open in', async () => {
    getGeoCountry.mockResolvedValue('FR');

    await expect(geoMarketSlug(LISTED)).resolves.toBeNull();
  });

  it('gives up quietly when the request comes back with nothing', async () => {
    getGeoCountry.mockResolvedValue(undefined);

    await expect(
      geoMarketSlug(LISTED),
      'a rate-limited or failed server function resolves to undefined on the client, and reading off it turns the site root into the error page',
    ).resolves.toBeNull();
  });

  it('gives up quietly when geo cannot be reached', async () => {
    getGeoCountry.mockRejectedValue(new Error('offline'));

    await expect(geoMarketSlug(LISTED)).resolves.toBeNull();
  });

  it('names no market when geo says nothing', async () => {
    getGeoCountry.mockResolvedValue(null);

    await expect(geoMarketSlug(LISTED)).resolves.toBeNull();
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

describe('homeMarketSlug', () => {
  it('trusts a remembered market the context already lists, without asking the server', async () => {
    await expect(homeMarketSlug(LISTED, 'egypt')).resolves.toBe('egypt');

    expect(
      getGeoCountry,
      'the cookie holds a slug this application issued and the context already lists it, so confirming it over the network is a round-trip spent re-deriving something known',
    ).not.toHaveBeenCalled();
    expect(getMarketLanding).not.toHaveBeenCalled();
  });

  it('falls back to geo when the cookie names a market that is no longer listed', async () => {
    getGeoCountry.mockResolvedValue('SA');

    await expect(
      homeMarketSlug(LISTED, 'atlantis'),
      'a closed market sends its readers to their own country’s market, not to whatever the default is',
    ).resolves.toBe('saudi-arabia');
    expect(getGeoCountry).toHaveBeenCalledTimes(1);
    expect(getMarketLanding).not.toHaveBeenCalled();
  });

  it('detects geo for a visitor arriving without a cookie', async () => {
    getGeoCountry.mockResolvedValue('DZ');

    await expect(homeMarketSlug(LISTED, undefined)).resolves.toBe('algeria');
    expect(getGeoCountry).toHaveBeenCalledTimes(1);
    expect(getMarketLanding).not.toHaveBeenCalled();
  });

  it('gives the caller its default when nothing can be resolved', async () => {
    getGeoCountry.mockResolvedValue(null);

    await expect(homeMarketSlug([], undefined)).resolves.toBeNull();
  });
});

describe('landingMarketSlug', () => {
  it('lands a visitor in the market they came from', async () => {
    await expect(landingMarketSlug(LISTED, 'egypt')).resolves.toBe('egypt');
  });

  it('falls back to Algeria only once nothing else can name a market', async () => {
    getGeoCountry.mockResolvedValue('FR');

    await expect(landingMarketSlug(LISTED, undefined)).resolves.toBe('algeria');
  });
});

const routeSource = (route: string): string =>
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../routes', route),
    'utf8',
  );

describe('the two arrivals that name no city', () => {
  it.each(['index.tsx', '$locale/index.tsx'])(
    '%s chooses its market the same way, so naming a language does not move it',
    (route) => {
      expect(routeSource(route)).toContain('landingMarketSlug(');
    },
  );

  it('leaves no route picking a market by writing the default out by hand', () => {
    for (const route of ['index.tsx', '$locale/index.tsx']) {
      expect(
        routeSource(route),
        `${route} hardcodes a market instead of resolving one`,
      ).not.toMatch(/'algeria'/);
    }
  });
});
