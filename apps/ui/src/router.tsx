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

import { routeTree } from './routeTree.gen';

const useLocale = (): Locale =>
  useRouterState({
    select: (s) =>
      (
        s.matches.find((m) => m.routeId === '__root__')?.context as
          { locale?: Locale } | undefined
      )?.locale ?? 'ar',
  }) as Locale;

const DefaultErrorComponent = ({ error }: { error: unknown }) => {
  useEffect(() => {
    reportError(error, { source: 'route' }, logger);
  }, [error]);
  const locale = useLocale();

  return (
    <section className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="mb-4 text-6xl" aria-hidden="true">
        ⚠️
      </div>
      <h1 className="text-2xl font-bold text-primary">
        {error_title({}, { locale })}
      </h1>
      <p className="mt-2 text-sm text-base-content/70">
        {error_body({}, { locale })}
      </p>
      <Link to="/" className="btn btn-primary mt-6">
        {back_home({}, { locale })}
      </Link>
    </section>
  );
};

const DefaultNotFoundComponent = () => {
  const locale = useLocale();

  return (
    <section className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="mb-4 text-6xl" aria-hidden="true">
        ☕
      </div>
      <h1 className="text-2xl font-bold text-primary">
        {not_found_title({}, { locale })}
      </h1>
      <p className="mt-2 text-sm text-base-content/70">
        {not_found_body({}, { locale })}
      </p>
      <Link to="/" className="btn btn-ghost mt-6 border border-base-300">
        {back_home({}, { locale })}
      </Link>
    </section>
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
    defaultNotFoundComponent: DefaultNotFoundComponent,
    parseSearch,
    stringifySearch,
  });

  return router;
};

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
