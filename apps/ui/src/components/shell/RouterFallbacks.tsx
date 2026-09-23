import { Link, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';

import {
  back_home,
  error_body,
  error_title,
  hero_search_cta,
  not_found_body,
  not_found_title,
  type Locale,
} from '@founders-coffee/i18n';
import { logger, reportError } from '@founders-coffee/observability';

import { localizedHome } from '../../lib/locale-routing';
import { EmptyState } from '../landing/EmptyState';
import { RouteTransition } from './RouteTransition';

type RootContext = {
  readonly locale?: Locale;
  readonly activeMarket?: { readonly slug: string };
};

const rootContext = (state: {
  matches: readonly { routeId: string; context: unknown }[];
}): RootContext | undefined =>
  state.matches.find((match) => match.routeId === '__root__')?.context as
    RootContext | undefined;

export const useRouterLocale = (): Locale =>
  useRouterState({ select: (state) => rootContext(state)?.locale ?? 'ar' });

const useRouterMarketSlug = (): string | undefined =>
  useRouterState({
    select: (state) => rootContext(state)?.activeMarket?.slug,
  });

export const RouterPending = () => (
  <RouteTransition locale={useRouterLocale()} />
);

export const RouterError = ({ error }: { error: unknown }) => {
  useEffect(() => {
    reportError(error, { source: 'route' }, logger);
  }, [error]);
  const locale = useRouterLocale();
  const marketSlug = useRouterMarketSlug();

  return (
    <EmptyState
      headingLevel="h1"
      title={error_title({}, { locale })}
      body={error_body({}, { locale })}
      action={
        <Link
          {...localizedHome(locale, marketSlug)}
          className="btn btn-primary h-12 px-5"
        >
          {back_home({}, { locale })}
        </Link>
      }
    />
  );
};

export const RouterNotFound = () => {
  const locale = useRouterLocale();
  const marketSlug = useRouterMarketSlug();

  return (
    <EmptyState
      headingLevel="h1"
      title={not_found_title({}, { locale })}
      body={not_found_body({}, { locale })}
      action={
        <Link
          {...localizedHome(locale, marketSlug)}
          className="btn btn-outline h-12 px-5"
        >
          {hero_search_cta({}, { locale })}
        </Link>
      }
    />
  );
};
