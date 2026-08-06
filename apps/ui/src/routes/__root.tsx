import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { useEffect } from 'react'

import { detectLocale, direction } from '@founders-coffee/i18n'
import { configureClientLogger, logger, reportError } from '@founders-coffee/observability'
import { getVisibleMarkets } from '@founders-coffee/server-fns'

import { Footer } from '../components/shell/Footer'
import { Navbar } from '../components/shell/Navbar'
import { AppProviders } from '../lib/app-providers'
import { readCookieHeader } from '../lib/cookies'

import appCss from '../styles.css?url'

const detectActiveLocale = () => {
  const locale = detectLocale(readCookieHeader())
  return { locale, dir: direction(locale) }
}

const useClientObservability = () => {
  useEffect(() => {
    configureClientLogger({ endpoint: '/client-logs' })
    const onError = (event: ErrorEvent) => reportError(event.error, { source: 'window' }, logger)
    const onRejection = (event: PromiseRejectionEvent) =>
      reportError(event.reason, { source: 'window' }, logger)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
}

const RootDocument = ({ children }: { children: React.ReactNode }) => {
  const { locale, dir, markets } = Route.useRouteContext()
  useClientObservability()

  return (
    <html lang={locale} dir={dir}>
      <head>
        <HeadContent />
      </head>
      <body className="bg-base-100 text-base-content">
        <AppProviders>
          <Navbar locale={locale} />
          <main>{children}</main>
          <Footer locale={locale} markets={markets} />
        </AppProviders>
        <Scripts />
      </body>
    </html>
  )
}

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
      { name: 'description', content: 'founders.coffee — local founder communities' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})
