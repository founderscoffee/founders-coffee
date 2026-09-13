import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router';
import { useEffect } from 'react';

import { detectLocale, direction, isLocale } from '@founders-coffee/i18n';
import {
  configureClientLogger,
  logger,
  reportError,
} from '@founders-coffee/observability';
import { getVisibleMarkets } from '@founders-coffee/server-fns';

import { registerServiceWorker } from '../features/push/service-worker';
import { useStoredLocale } from '../features/preferences/use-stored-locale';
import { Footer } from '../components/shell/Footer';
import { Navbar } from '../components/shell/Navbar';
import { AppProviders } from '../lib/app-providers';
import { readCookieHeader } from '../lib/cookies';
import { organizationJsonLd } from '../lib/seo-company';

import appCss from '../styles.css?url';

const detectActiveLocale = (routeLocale?: string) => {
  const locale = isLocale(routeLocale)
    ? routeLocale
    : detectLocale(readCookieHeader());
  return { locale, dir: direction(locale) };
};

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
    void registerServiceWorker();
  }, []);
};

const RootDocument = ({ children }: { children: React.ReactNode }) => {
  const { locale, dir, markets } = Route.useRouteContext();
  useClientObservability();
  useServiceWorker();
  useStoredLocale(locale);

  return (
    <html lang={locale} dir={dir}>
      <head>
        <HeadContent />
      </head>
      <body className="flex flex-col bg-base-100 text-base-content">
        <AppProviders>
          <Navbar locale={locale} />
          <main className="flex-1">{children}</main>
          <Footer locale={locale} markets={markets} />
        </AppProviders>
        <Scripts />
      </body>
    </html>
  );
};

export const Route = createRootRoute({
  beforeLoad: async ({ params }) => {
    const routeParams = params as { readonly market?: string };
    const { locale, dir } = detectActiveLocale(routeParams.market);
    const markets = await getVisibleMarkets();
    return { locale, dir, markets: markets ?? [] };
  },
  head: () => {
    return {
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#270F00' },
      ],
      links: [
        { rel: 'stylesheet', href: appCss },
        { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
        { rel: 'icon', href: '/favicon-32x32.png', sizes: '32x32' },
        { rel: 'icon', href: '/favicon-16x16.png', sizes: '16x16' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/manifest.json' },
      ],
      scripts: [
        { type: 'application/ld+json', children: organizationJsonLd() },
      ],
    };
  },
  shellComponent: RootDocument,
});
