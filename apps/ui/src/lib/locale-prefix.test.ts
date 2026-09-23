import { describe, expect, it } from 'vitest';

import { decidePrefix, isLocaleDirect } from './locale-prefix';
import { declaredRoutes } from './route-contract.fixtures';

const MARKETS = [
  { code: 'DZ', slug: 'algeria' },
  { code: 'EG', slug: 'egypt' },
];

const at = (href: string) => decidePrefix(href, 'fr', MARKETS);

const staticChildAt = (prefix: string, depth: number): Set<string> =>
  new Set(
    declaredRoutes()
      .filter(({ fullPath }) => fullPath.startsWith(`${prefix}/`))
      .map(({ fullPath }) => fullPath.split('/').filter(Boolean)[depth])
      .filter((segment): segment is string => !!segment && segment[0] !== '$'),
  );

describe('answering an address that does not open on a language', () => {
  it('leaves an address that already names one alone', () => {
    expect(at('/ar/algeria')).toEqual({ kind: 'prefixed' });
    expect(at('/en/algeria/algiers')).toEqual({ kind: 'prefixed' });
    expect(at('/')).toEqual({ kind: 'prefixed' });
  });

  it('puts the language in front of a market, because the market is part of the address', () => {
    expect(at('/algeria')).toEqual({
      kind: 'elsewhere',
      href: '/fr/algeria',
    });
    expect(at('/algeria/algiers')).toEqual({
      kind: 'elsewhere',
      href: '/fr/algeria/algiers',
    });
  });

  it('writes a market code as its slug rather than spending a hop on it', () => {
    expect(
      at('/dz/e/coffee'),
      'the market routes would answer the code with the slug anyway, one redirect later',
    ).toEqual({ kind: 'elsewhere', href: '/fr/algeria/e/coffee' });
  });

  it('drops a market sitting in front of a screen that takes none', () => {
    expect(
      at('/algeria/profile/activity'),
      'the private screens are not a market page, so a market in front of one is noise rather than part of the address',
    ).toEqual({ kind: 'elsewhere', href: '/fr/profile/activity' });
    expect(at('/algeria/u/usr_1')).toEqual({
      kind: 'elsewhere',
      href: '/fr/u/usr_1',
    });
  });

  it('keeps a meetup under its market, which is the one segment that is in both', () => {
    expect(
      at('/algeria/e/coffee'),
      '`/algeria/e/{slug}` was the canonical address before the prefix existed and is still indexed under it',
    ).toEqual({ kind: 'elsewhere', href: '/fr/algeria/e/coffee' });
  });

  it('carries the search and the fragment across', () => {
    expect(at('/algeria?afterId=evt_1#top')).toEqual({
      kind: 'elsewhere',
      href: '/fr/algeria?afterId=evt_1#top',
    });
  });

  it('says an address naming neither is no address, rather than redirecting to a 404', () => {
    expect(at('/nonsense')).toEqual({ kind: 'nowhere' });
    expect(
      at('/definitely/not/a/route'),
      'answering a crawler mistake with a redirect hands the shared cache a hop it is allowed to keep',
    ).toEqual({ kind: 'nowhere' });
  });
});

describe('the set of segments that follow a language directly', () => {
  it('is exactly what the route tree says it is', () => {
    const underLocale = staticChildAt('/$locale', 1);
    const underMarket = staticChildAt('/$locale/$market', 2);

    expect(
      underLocale.size,
      'no static children parsed out of the tree, so the comparison below is vacuous',
    ).toBeGreaterThan(4);

    for (const segment of underLocale)
      expect(
        isLocaleDirect(segment),
        `/{locale}/${segment} is a route, so a market in front of it is noise${underMarket.has(segment) ? ' — unless it is also a child of $market, as this one is' : ''}`,
      ).toBe(!underMarket.has(segment));
  });

  it('claims nothing the tree does not have', () => {
    const underLocale = staticChildAt('/$locale', 1);

    for (const segment of ['algeria', 'host', 'algiers', 'e'])
      expect(
        isLocaleDirect(segment) && !underLocale.has(segment),
        `${segment} is treated as following a language directly but is not a route under one`,
      ).toBe(false);
  });
});
