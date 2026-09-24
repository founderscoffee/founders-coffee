import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  type AnyRoute,
} from '@tanstack/react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Route as LocaleIndexStub } from '../routes/$locale/index';
import { Route as HomeStub } from '../routes/index';
import { declaredRoutes, read, sourceOf } from './route-contract.fixtures';

const lookups = vi.hoisted(() => ({
  made: [] as string[],
  geo: (): Promise<string> => Promise.resolve('DZ'),
}));

vi.mock('@founders-coffee/server-fns', () => ({
  getCityLanding: vi.fn(),
  getVisibleMarkets: vi.fn(),
  getGeoCountry: () => {
    lookups.made.push('getGeoCountry');
    return lookups.geo();
  },
  getMarketLanding: () => {
    lookups.made.push('getMarketLanding');
    return Promise.resolve({ market: { slug: 'algeria' } });
  },
}));

vi.mock('./cookies', () => ({
  readCookies: () => ({}),
  readCookieHeader: () => null,
}));

/**
 * The routes that render nothing and exist only to hand the reader somewhere else.
 *
 * Read out of the tree rather than listed by hand, because a list by hand is what went stale:
 * `5f7a5f3` recorded that "every redirect-only route is now `preload: false`" and named seven, and
 * two more have been added to the tree since without anyone revisiting the sentence.
 *
 * A route qualifies when it declares no component, or one that renders `null`, and names a
 * redirect. Both exclusions carry weight. `/sw.js` renders `null` but throws `notFound`, which is
 * not a redirect and has nothing to opt out of. `/og/e/$id` does answer a redirect, but from a
 * `server` handler, which no `<Link>` can preload.
 */
const redirectOnlyRoutes = () =>
  declaredRoutes().filter(({ file }) => {
    const body = sourceOf(file);
    const rendersNothing =
      !/\bcomponent:/u.test(body) || /\bcomponent: \(\) => null\b/u.test(body);
    return (
      rendersNothing && /redirect/iu.test(body) && !/\bserver: \{/u.test(body)
    );
  });

const redirectsFromLoader = (body: string): boolean => /\bloader:/u.test(body);

const optsOut = (body: string): boolean => /\bpreload: false\b/u.test(body);

/**
 * The redirect-only routes whose opt-out disagrees with where they throw their redirect.
 *
 * router-core reads a route's `preload` in one place, the loader step of a preload, which it skips
 * for a route that says `false`. A redirect thrown from a loader is therefore kept off a hover by
 * the opt-out, and one thrown from `beforeLoad` is not, because every `beforeLoad` runs.
 */
const routesWhere = (mismatch: (body: string) => boolean): readonly string[] =>
  redirectOnlyRoutes()
    .filter(({ file }) => mismatch(sourceOf(file)))
    .map(({ fullPath, file }) => `${fullPath} (${file})`);

/**
 * The window the router keeps a preloaded match fresh for, read through the constant that names it.
 *
 * Reading the call site alone would take `defaultPreloadStaleTime: PRELOAD_STALE_TIME_MS` at its
 * word, and the window can be closed just as well by zeroing the constant as by zeroing the call.
 * An expression this cannot resolve reads as `NaN`, which fails the assertion rather than passing
 * it, because a window nobody can read is not one anybody should be trusting.
 */
const preloadWindowMs = (): number => {
  const source = read('../router.tsx');
  const set = /defaultPreloadStaleTime: ([\w.]+),/u.exec(source)?.[1] ?? '';
  const literal = /^\d[\d_]*$/u.test(set)
    ? set
    : (new RegExp(`const ${set} = ([\\d_]+)`, 'u').exec(source)?.[1] ?? '');
  return Number(literal.replaceAll('_', ''));
};

const hops: string[] = [];

/**
 * Hang one of the app's own routes under a stand-in parent, the way `routeTree.gen.ts` does.
 *
 * The generated tree calls `update({ id, path, getParentRoute })`, and `update` is an
 * `Object.assign` onto the route's options, so this is the same act without its `as any`.
 */
const hang = <TRoute extends AnyRoute>(
  route: TRoute,
  path: string,
  parent: AnyRoute,
): TRoute => {
  Object.assign(route.options, {
    id: path,
    path,
    getParentRoute: () => parent,
  });
  return route;
};

const rootRoute = createRootRoute({
  beforeLoad: ({ location }) => {
    hops.push(location.href);
    return { locale: 'fr', markets: [{ code: 'DZ', slug: 'algeria' }] };
  },
});
const localeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '$locale',
});
const marketRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: '$market',
});
const routeTree = rootRoute.addChildren([
  hang(HomeStub, '/', rootRoute),
  localeRoute.addChildren([
    hang(LocaleIndexStub, '/', localeRoute),
    marketRoute,
  ]),
]);

/**
 * A router over the real `/` and `/$locale/` stubs, already showing a page when the hover comes.
 *
 * It keeps a preloaded match fresh for as long as the app's own router does. The stand-in root
 * records every address the router loads, a preload included, so `hops` shows each redirect a
 * hover followed; `lookups` shows each server function the stubs asked.
 */
const readerOn = async (href: string) => {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [href] }),
    defaultPreloadStaleTime: preloadWindowMs(),
  });
  await router.load();
  hops.length = 0;
  lookups.made.length = 0;
  return router;
};

const declared = {
  home: HomeStub.options.preload,
  localeIndex: LocaleIndexStub.options.preload,
};

afterEach(() => {
  Object.assign(HomeStub.options, { preload: declared.home });
  Object.assign(LocaleIndexStub.options, { preload: declared.localeIndex });
  lookups.geo = () => Promise.resolve('DZ');
});

describe('the preload contract', () => {
  it('finds the redirect-only routes, in the shapes they come in', () => {
    const bodies = redirectOnlyRoutes().map(({ file }) => sourceOf(file));

    expect(
      bodies.length,
      'no route matched, so the assertions below pass without having read anything',
    ).toBeGreaterThan(10);
    expect(
      bodies.some((body) => !/\bcomponent:/u.test(body)),
      'nothing matched by declaring no component at all, which is the shape the company stubs have',
    ).toBe(true);
    expect(
      bodies.some((body) => /\bcomponent: \(\) => null\b/u.test(body)),
      'nothing matched by rendering null, which is the shape /$locale/ and /$locale/e/$slug have, and the one a narrowed filter would drop first',
    ).toBe(true);
    expect(
      bodies.filter(redirectsFromLoader).length,
      'nothing matched that redirects from a loader, the only shape an opt-out does anything for, so the first rule below holds of nothing',
    ).toBeGreaterThan(0);
  });

  it('opts every route that redirects from its loader out of preloading', () => {
    const preloadable = routesWhere(
      (body) => redirectsFromLoader(body) && !optsOut(body),
    );

    expect(
      preloadable,
      `these routes throw their redirect from a loader, and a hover runs that loader, spending its lookups on a page that draws nothing, unless the route says \`preload: false\`:\n${preloadable.join('\n')}`,
    ).toEqual([]);
  });

  it('leaves the opt-out off every route that redirects before it loads', () => {
    const inert = routesWhere(
      (body) => !redirectsFromLoader(body) && optsOut(body),
    );

    expect(
      inert,
      `these routes throw their redirect from \`beforeLoad\`, which a hover runs whatever the route says, so \`preload: false\` keeps nothing off it here and only reads as though it did. A hover is stopped at the link, with \`preload={false}\`, as localizedHome does for \`/\`:\n${inert.join('\n')}`,
    ).toEqual([]);
  });

  it('leaves the preload window open', () => {
    expect(
      preloadWindowMs(),
      'a window of 0 refetches the route under the cursor on every hover, which measured 13 requests for three hovers of one card against 7 with the window open. 518c334 closed it for fear that a preloaded stub would leave a cached match to answer the click instead of the redirect. No opt-out is what prevents that: a hover caches nothing of a stub it was redirected from, which the clicks below show',
    ).toBeGreaterThan(0);
  });
});

describe('hovering a link to a route that only redirects', () => {
  it.each([undefined, false])(
    'runs a redirect thrown from beforeLoad, lookups and all, with preload: %s',
    async (preload) => {
      Object.assign(HomeStub.options, { preload });
      const router = await readerOn('/fr/terms');

      await router.preloadRoute({ to: '/' });

      expect(hops).toEqual(['/', '/ar/algeria']);
      expect(lookups.made).toEqual(['getGeoCountry', 'getMarketLanding']);
    },
  );

  it('keeps a redirect thrown from a loader off the hover while the route opts out', async () => {
    const router = await readerOn('/fr/terms');

    await router.preloadRoute({ to: '/$locale', params: { locale: 'fr' } });

    expect(hops).toEqual(['/fr']);
    expect(lookups.made).toEqual([]);
  });

  it('runs that loader and follows its redirect once the route stops opting out', async () => {
    Object.assign(LocaleIndexStub.options, { preload: undefined });
    const router = await readerOn('/fr/terms');

    await router.preloadRoute({ to: '/$locale', params: { locale: 'fr' } });

    expect(hops).toEqual(['/fr', '/fr/algeria']);
    expect(lookups.made).toEqual(['getGeoCountry', 'getMarketLanding']);
  });
});

describe('clicking a stub inside the preload window', () => {
  it('redirects again, because the hover cached nothing of the stub', async () => {
    const router = await readerOn('/fr/terms');
    await router.preloadRoute({ to: '/' });

    expect(
      router.stores.cachedMatches.get().map(({ routeId }) => routeId),
    ).not.toContain('/');

    await router.navigate({ to: '/' });

    expect(router.state.location.href).toBe('/ar/algeria');
  });

  it('redirects a click on a stub whose loader the hover skipped', async () => {
    const router = await readerOn('/fr/terms');
    await router.preloadRoute({ to: '/$locale', params: { locale: 'fr' } });

    await router.navigate({ to: '/$locale', params: { locale: 'fr' } });

    expect(router.state.location.href).toBe('/fr/algeria');
  });

  it('redirects a click that comes while the hover is still waiting on its lookup', async () => {
    const answers: ((country: string) => void)[] = [];
    lookups.geo = () => new Promise((resolve) => answers.push(resolve));
    const router = await readerOn('/fr/terms');

    const hovering = router.preloadRoute({ to: '/' });
    await vi.waitFor(() => expect(answers).toHaveLength(1));
    const clicking = router.navigate({ to: '/' });
    lookups.geo = () => Promise.resolve('DZ');
    answers.forEach((answer) => answer('DZ'));
    await Promise.all([hovering, clicking]);

    expect(router.state.location.href).toBe('/ar/algeria');
    expect(
      lookups.made,
      'the click ran the stub for itself rather than taking the answer the hover was still waiting for',
    ).toEqual([
      'getGeoCountry',
      'getMarketLanding',
      'getGeoCountry',
      'getMarketLanding',
    ]);
  });
});
