import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { getCookies, getRequestHeader } from '@tanstack/react-start/server'
import { useEffect } from 'react'

import { cookieName, detectLocale, direction } from '@founders-coffee/i18n'
import { configureClientLogger, logger, reportError } from '@founders-coffee/observability'

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
 * and promise rejections through `reportError` (which beacons via the client logger → the same
 * Workers Logs stream as server logs, AGENTS §13). Server-side route/load errors are already
 * reported by `requestContextMiddleware` (Phase A).
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

const RootDocument = ({ children }: { children: React.ReactNode }) => {
  const { locale, dir } = Route.useRouteContext()
  useClientObservability()

  return (
    <html lang={locale} dir={dir}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}

export const Route = createRootRoute({
  beforeLoad: () => detectLocaleFromRequest(),
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'founders.coffee',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})
