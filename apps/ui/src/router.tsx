import { createRouter as createTanStackRouter } from '@tanstack/react-router';

import {
  RouterError,
  RouterNotFound,
  RouterPending,
} from './components/shell/RouterFallbacks';
import { getRequestContext } from '@founders-coffee/observability/context';

import { parseSearch, stringifySearch } from './lib/search-params';
import { routeTree } from './routeTree.gen';

const PRELOAD_STALE_TIME_MS = 30_000;

export const getRouter = () => {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: PRELOAD_STALE_TIME_MS,
    defaultErrorComponent: RouterError,
    defaultPendingComponent: RouterPending,
    defaultNotFoundComponent: RouterNotFound,
    parseSearch,
    stringifySearch,
    ssr: { nonce: getRequestContext().cspNonce },
  });

  return router;
};

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
