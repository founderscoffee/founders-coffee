import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  notFound,
  type AnyRoute,
} from '@tanstack/react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Route as LocaleRoute } from '../routes/$locale';
import { Route as LocaleLoginRoute } from '../routes/$locale.login';
import { parseSearch, stringifySearch } from './search-params';

const session = vi.hoisted(() => ({ isSignedIn: false, checks: 0 }));

vi.mock('../features/auth/api', () => ({
  authApi: {
    hasAuthSession: () => {
      session.checks += 1;
      return Promise.resolve(session.isSignedIn);
    },
    getPublicAuthConfig: () =>
      Promise.resolve({
        turnstileSiteKey: '',
        isTurnstileBypassed: true,
        hasSocial: false,
      }),
  },
}));

vi.mock('./cookies', () => ({
  readCookies: () => ({}),
  readCookieHeader: () => null,
}));

const HOP_LIMIT = 12;

const loaded: string[] = [];

/**
 * Hang one of the app's own routes under a parent, the way `routeTree.gen.ts` does.
 *
 * The generated tree calls `update({ id, path, getParentRoute })`, and `update` is an
 * `Object.assign` onto the route's options. Its type admits none of those three keys, which the
 * generated file gets past with `as any`; assigning them here is the same act, and stays typed.
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
    loaded.push(location.href);
    if (loaded.length > HOP_LIMIT) throw notFound();
    return { locale: 'fr', markets: [{ code: 'DZ', slug: 'algeria' }] };
  },
});
const localeRoute = hang(LocaleRoute, '/$locale', rootRoute);
const loginRoute = hang(LocaleLoginRoute, '/login', localeRoute);
const marketRoute = createRoute({
  getParentRoute: () => localeRoute,
  path: '$market',
  validateSearch: (search: Record<string, unknown>) => search,
});
const cityRoute = createRoute({
  getParentRoute: () => marketRoute,
  path: '$city',
});
const routeTree = rootRoute.addChildren([
  localeRoute.addChildren([loginRoute, marketRoute.addChildren([cityRoute])]),
]);

/**
 * A router over the app's `$locale` and `$locale/login`, hung under a stand-in root.
 *
 * The root's `beforeLoad` runs for every address the router loads, a preload included, and
 * router-core follows a redirect it meets while preloading by preloading again, so `loaded` lists
 * every hop. The root refuses to go on after `HOP_LIMIT`, which a preload takes as its end: one
 * that never ends would hang this test rather than fail it, and what `loaded` holds by then shows
 * where it went round.
 */
const createTestRouter = () =>
  createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/fr/algeria'] }),
    parseSearch,
    stringifySearch,
  });

afterEach(() => {
  loaded.length = 0;
  session.isSignedIn = false;
  session.checks = 0;
});

describe('preloading the sign-in page with a session the tab has not noticed', () => {
  it('preloads it as it is for a reader who is signed out', async () => {
    await createTestRouter().preloadRoute({
      to: '/$locale/login',
      params: { locale: 'fr' },
      search: { redirect: '/fr/algeria' },
    });

    expect(loaded).toEqual(['/fr/login?redirect=%2Ffr%2Falgeria']);
    expect(session.checks).toBe(1);
  });

  it('follows the redirect once, to where a signed-in reader was headed', async () => {
    session.isSignedIn = true;

    await createTestRouter().preloadRoute({
      to: '/$locale/login',
      params: { locale: 'fr' },
      search: { redirect: '/fr/algeria' },
    });

    expect(
      loaded,
      'a redirect by `href` is preloaded as the page that threw it, here /fr/login with its query dropped, so the guard throws it again for as long as the tab is open',
    ).toEqual(['/fr/login?redirect=%2Ffr%2Falgeria', '/fr/algeria']);
    expect(
      session.checks,
      'every lap of that loop asks the server for the session again: 429 requests in four seconds in the browser',
    ).toBe(1);
  });

  it('keeps the query and the fragment of the destination', async () => {
    session.isSignedIn = true;

    await createTestRouter().preloadRoute({
      to: '/$locale/login',
      params: { locale: 'fr' },
      search: { redirect: '/fr/algeria/algiers?page=2#events' },
    });

    expect(loaded.at(-1)).toBe('/fr/algeria/algiers?page=2#events');
    expect(loaded).toHaveLength(2);
  });
});

describe('preloading an address that puts a market where the language goes', () => {
  it('follows the redirect once, to the same address in a language', async () => {
    await createTestRouter().preloadRoute({
      to: '/$locale/$market',
      params: { locale: 'dz', market: 'algiers' },
      search: { page: '2' },
    });

    expect(
      loaded,
      'the layout answers with the prefixed address, and a preload that cannot read it rebuilds /dz/algiers and meets the same answer again',
    ).toEqual(['/dz/algiers?page=2', '/ar/algeria/algiers?page=2']);
  });
});

describe('navigating to a page whose guard redirects', () => {
  it('still lands a signed-in reader where they were headed', async () => {
    session.isSignedIn = true;
    const router = createTestRouter();

    await router.navigate({
      to: '/$locale/login',
      params: { locale: 'fr' },
      search: { redirect: '/fr/algeria/algiers?page=2#events' },
    });

    expect(router.state.location.href).toBe(
      '/fr/algeria/algiers?page=2#events',
    );
  });

  it('still lands an unprefixed address on its prefixed form', async () => {
    const router = createTestRouter();

    await router.navigate({ href: '/dz/algiers?page=2' });

    expect(router.state.location.href).toBe('/ar/algeria/algiers?page=2');
  });
});
