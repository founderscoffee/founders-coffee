import { HeadContent, Link, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { getCookies, getRequestHeader } from '@tanstack/react-start/server'
import { useEffect } from 'react'

import type { Market } from '@founders-coffee/db'
import { brand, cookieName, detectLocale, direction, LOCALES, type Locale } from '@founders-coffee/i18n'
import { configureClientLogger, logger, reportError } from '@founders-coffee/observability'
import { getVisibleMarkets } from '@founders-coffee/server-fns'

import appCss from '../styles.css?url'

/**
 * Resolve the active locale from the request — cookie first (FR-L6 override), then
 * `Accept-Language`, then the base locale. Runs once at SSR (root is always active); the cookie
 * value is reconstructed as a header entry to match `detectLocale`'s signature. Message rendering
 * threads `{ locale }` explicitly downstream (the i18n design — no global runtime state).
 */
const detectLocaleFromRequest = () => {
  const value = getCookies()[cookieName]
  const cookieHeader = value ? `${cookieName}=${value}` : null
  const accept = getRequestHeader('accept-language') ?? null
  const locale = detectLocale(cookieHeader, accept)
  return { locale, dir: direction(locale) }
}

/**
 * Client-only bootstrap: point the isomorphic `logger` at `/client-logs` + capture uncaught errors
 * and promise rejections through `reportError` (beacons via the client logger → Workers Logs, AGENTS §13).
 */
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

/** Switch the active locale (cookie-based, clean URLs — SRS §8.6) + reload to re-resolve. */
const LocaleToggle = ({ locale }: { locale: Locale }) => {
  const change = (l: Locale) => {
    document.cookie = `${cookieName}=${l}; path=/; max-age=31536000; samesite=lax`
    window.location.reload()
  }
  return (
    <div className="flex gap-2 text-sm">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => change(l)}
          className={l === locale ? 'font-bold text-primary' : 'text-base-content/60 hover:text-base-content'}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

const Navbar = () => {
  const markets = Route.useLoaderData()
  const { locale } = Route.useRouteContext()
  return (
    <nav className="flex items-center justify-between gap-4 border-b border-base-300 px-4 py-3">
      <Link to="/" className="text-lg font-bold text-primary">
        {brand({}, { locale })}
      </Link>
      <div className="flex items-center gap-4">
        <div className="flex gap-3 text-sm">
          {markets.map((mk) => (
            <Link
              key={mk.code}
              to="/$market"
              params={{ market: mk.slug }}
              className="text-base-content/80 hover:text-primary"
              activeProps={{ className: 'text-primary font-semibold' }}
            >
              {mk.name}
            </Link>
          ))}
        </div>
        <LocaleToggle locale={locale} />
      </div>
    </nav>
  )
}

const RootDocument = ({ children }: { children: React.ReactNode }) => {
  const { locale, dir } = Route.useRouteContext()
  useClientObservability()

  return (
    <html lang={locale} dir={dir}>
      <head>
        <HeadContent />
      </head>
      <body className="bg-base-100 text-base-content">
        <Navbar />
        <main>{children}</main>
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
