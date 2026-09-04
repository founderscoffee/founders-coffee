import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router';
import { useEffect } from 'react';

import { detectLocale, direction } from '@founders-coffee/i18n';
import {
  configureClientLogger,
  logger,
  reportError,
} from '@founders-coffee/observability';
import { getVisibleMarkets } from '@founders-coffee/server-fns';

import { Footer } from '../components/shell/Footer';
import { Navbar } from '../components/shell/Navbar';
import { AppProviders } from '../lib/app-providers';
import { readCookieHeader } from '../lib/cookies';
import { SITE_ORIGIN, organizationJsonLd } from '../lib/seo';

import appCss from '../styles.css?url';

const detectActiveLocale = () => {
  const locale = detectLocale(readCookieHeader());
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

const RootDocument = ({ children }: { children: React.ReactNode }) => {
  const { locale, dir, markets } = Route.useRouteContext();
  useClientObservability();

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
  beforeLoad: async () => {
    const { locale, dir } = detectActiveLocale();
    const markets = await getVisibleMarkets();
    return { locale, dir, markets: markets ?? [] };
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'founders.coffee' },
      {
        name: 'description',
        content:
          'founders.coffee - local founder communities that meet over coffee.',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'founders.coffee' },
      { property: 'og:title', content: 'founders.coffee' },
      {
        property: 'og:description',
        content:
          'Local founder communities that meet over coffee - real conversations, no formalities.',
      },
      { property: 'og:url', content: SITE_ORIGIN },
      { name: 'twitter:card', content: 'summary' },
      { name: 'theme-color', content: '#270F00' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'canonical', href: SITE_ORIGIN },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'icon', href: '/favicon-32x32.png', sizes: '32x32' },
      { rel: 'icon', href: '/favicon-16x16.png', sizes: '16x16' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/manifest.json' },
    ],
    scripts: [{ type: 'application/ld+json', children: organizationJsonLd() }],
  }),
  shellComponent: RootDocument,
});
