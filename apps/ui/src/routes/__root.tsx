import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { getCookies, getRequestHeader } from '@tanstack/react-start/server'

import { cookieName, detectLocale, direction } from '@founders-coffee/i18n'

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

const RootDocument = ({ children }: { children: React.ReactNode }) => {
  const { locale, dir } = Route.useRouteContext()

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
