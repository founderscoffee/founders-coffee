import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router';
import { useEffect } from 'react';

import {
  detectLocale,
  direction,
  isLocale,
  type Locale,
} from '@founders-coffee/i18n';
import {
  configureClientLogger,
  logger,
  reportError,
} from '@founders-coffee/observability';
import {
  toRootMarket,
  visibleMarkets,
  type RootMarket,
} from '../features/markets/api';
import { useStoredLocale } from '../features/preferences/use-stored-locale';
import { logServiceWorkerFailure } from '../features/push/service-worker-error';
import { Footer } from '../components/shell/Footer';
import { Navbar } from '../components/shell/Navbar';
import { AUTH_SLOT_SCRIPT } from '../features/auth/session-hint';
import { SkipLink } from '../components/shell/SkipLink';
import { AppProviders } from '../lib/app-providers';
import { readCookieHeader } from '../lib/cookies';
import {
  NO_INDEX_VALUE,
  PUBLIC_DOCUMENT_CACHE_CONTROL,
} from '../lib/indexation';
import { routeMarketSlug } from '../lib/route-market';
import { getRequestPath } from '../lib/seo';
import { organizationJsonLd } from '../lib/seo-company';
import { errorPageHead } from '../lib/seo-error';
import { manifestHref } from '../lib/web-manifest';

import appCss from '../styles.css?url';

const detectActiveLocale = (routeLocale?: string) => {
  const locale = isLocale(routeLocale)
    ? routeLocale
    : detectLocale(readCookieHeader());
  return { locale, dir: direction(locale) };
};

const localeFromRequest = (): Locale =>
  detectActiveLocale(getRequestPath().split('/').filter(Boolean)[0]).locale;

const useClientObservability = () => {
  useEffect(() => {
    configureClientLogger({ endpoint: '/client-logs' });
    const onError = (event: ErrorEvent) =>
      reportError(event.error, { source: 'window' }, logger);
    const onRejection = (event: PromiseRejectionEvent) =>
      reportError(event.reason, { source: 'window' }, logger);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
};

const useServiceWorker = () => {
  useEffect(() => {
    void import('../features/push/service-worker')
      .then(({ registerServiceWorker }) =>
        registerServiceWorker({ onRegistrationError: logServiceWorkerFailure }),
      )
      .catch(logServiceWorkerFailure);
  }, []);
};

const RootDocument = ({ children }: { children: React.ReactNode }) => {
  const { locale, dir, markets, activeMarket } = Route.useRouteContext();
  useClientObservability();
  useServiceWorker();
  useStoredLocale(locale);

  return (
    <html lang={locale} dir={dir} data-auth-slot="out" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex flex-col bg-base-100 text-base-content">
        <AppProviders>
          <SkipLink locale={locale} />
          <Navbar locale={locale} marketSlug={activeMarket?.slug} />
          <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
          <Footer locale={locale} markets={markets} market={activeMarket} />
        </AppProviders>
        <Scripts />
      </body>
    </html>
  );
};

export const Route = createRootRoute({
  beforeLoad: async ({ params }) => {
    const routeParams = params as {
      readonly market?: string;
      readonly city?: string;
    };
    const { locale, dir } = detectActiveLocale(routeParams.market);
    const markets = (await visibleMarkets()).map(toRootMarket);
    const slug = routeMarketSlug(routeParams);
    const activeMarket =
      markets.find((market: RootMarket) => market.slug === slug) ?? markets[0];
    return { locale, dir, markets, activeMarket };
  },
  headers: ({ matches }) => {
    const hasNoIndexableState = matches.some(
      (match) =>
        match.status === 'error' ||
        match.status === 'notFound' ||
        match.globalNotFound,
    );
    const headers: Record<string, string> = hasNoIndexableState
      ? {
          'Cache-Control': 'private, no-store',
          'X-Robots-Tag': NO_INDEX_VALUE,
        }
      : { 'Cache-Control': PUBLIC_DOCUMENT_CACHE_CONTROL };
    return headers;
  },
  head: ({ matches }) => {
    const locale = localeFromRequest();
    const hasNotFound = matches.some(
      (match) => match.status === 'notFound' || match.globalNotFound,
    );
    const hasError = matches.some((match) => match.status === 'error');
    const pageHead = hasNotFound
      ? errorPageHead(locale, 'notFound')
      : hasError
        ? errorPageHead(locale, 'error')
        : null;
    return {
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#270F00' },
        ...(pageHead?.meta ?? []),
      ],
      links: [
        { rel: 'stylesheet', href: appCss },
        { rel: 'icon', href: '/favicon-32x32.png', sizes: '32x32' },
        { rel: 'icon', href: '/favicon-16x16.png', sizes: '16x16' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: manifestHref(locale) },
        ...(pageHead?.links ?? []),
      ],
      scripts: [
        { children: AUTH_SLOT_SCRIPT },
        ...(pageHead?.scripts ?? [
          { type: 'application/ld+json', children: organizationJsonLd() },
        ]),
      ],
    };
  },
  shellComponent: RootDocument,
});
