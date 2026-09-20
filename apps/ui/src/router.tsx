import {
  Link,
  createRouter as createTanStackRouter,
  useRouterState,
} from '@tanstack/react-router';
import { parseSearchWith, stringifySearchWith } from '@tanstack/router-core';
import { useEffect } from 'react';

import {
  back_home,
  error_body,
  error_title,
  not_found_body,
  not_found_title,
  type Locale,
} from '@founders-coffee/i18n';
import { logger, reportError } from '@founders-coffee/observability';

import { EmptyState } from './components/landing/EmptyState';
import { RouteTransition } from './components/shell/RouteTransition';
import { getRequestContext } from '@founders-coffee/observability/context';

import { routeTree } from './routeTree.gen';

const useLocale = (): Locale =>
  useRouterState({
    select: (s) =>
      (
        s.matches.find((m) => m.routeId === '__root__')?.context as
          { locale?: Locale } | undefined
      )?.locale ?? 'ar',
  }) as Locale;

const DefaultPendingComponent = () => <RouteTransition locale={useLocale()} />;

const DefaultErrorComponent = ({ error }: { error: unknown }) => {
  useEffect(() => {
    reportError(error, { source: 'route' }, logger);
  }, [error]);
  const locale = useLocale();

  return (
    <EmptyState
      title={error_title({}, { locale })}
      body={error_body({}, { locale })}
      action={
        <Link to="/" className="btn btn-primary h-12 px-5">
          {back_home({}, { locale })}
        </Link>
      }
    />
  );
};

const DefaultNotFoundComponent = () => {
  const locale = useLocale();

  return (
    <EmptyState
      title={not_found_title({}, { locale })}
      body={not_found_body({}, { locale })}
      action={
        <Link to="/" className="btn btn-outline h-12 px-5">
          {back_home({}, { locale })}
        </Link>
      }
    />
  );
};

const parseSearch = parseSearchWith((val: string) => val);
const stringifySearch = stringifySearchWith(JSON.stringify, () => {
  throw 0;
});

export const getRouter = () => {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
    defaultPendingComponent: DefaultPendingComponent,
    defaultNotFoundComponent: DefaultNotFoundComponent,
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
