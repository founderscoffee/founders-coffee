import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { getCookies } from '@tanstack/react-start/server'
import { useEffect } from 'react'

import type { Market } from '@founders-coffee/db'
import { cookieName, detectLocale, direction } from '@founders-coffee/i18n'
import { configureClientLogger, logger, reportError } from '@founders-coffee/observability'
import { getVisibleMarkets } from '@founders-coffee/server-fns'

import { Footer } from '../components/Footer'
import { Navbar } from '../components/Navbar'

import appCss from '../styles.css?url'

const detectLocaleFromRequest = () => {
  const value = getCookies()[cookieName]
  const cookieHeader = value ? `${cookieName}=${value}` : null
  const locale = detectLocale(cookieHeader)
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
  const { locale, dir } = Route.useRouteContext()
  const markets = Route.useLoaderData()
  useClientObservability()

  return (
    <html lang={locale} dir={dir}>
      <head>
        <HeadContent />
      </head>
      <body className="bg-base-100 text-base-content">
        <Navbar locale={locale} />
        <main>{children}</main>
        <Footer locale={locale} markets={markets} />
        <TanStackDevtools
          config={{ position: 'bottom-right' }}
          plugins={[{ name: 'Tanstack Router', render: <TanStackRouterDevtoolsPanel /> }]}
        />
        <Scripts />
      </body>
    </html>
  )
}

export const Route = createRootRoute({
  beforeLoad: () => detectLocaleFromRequest(),
  loader: (): Promise<Market[]> => getVisibleMarkets(),
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
