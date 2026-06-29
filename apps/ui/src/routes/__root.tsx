import { HeadContent, Link, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { getCookies } from '@tanstack/react-start/server'
import { useEffect, useState } from 'react'

import type { Market } from '@founders-coffee/db'
import {
  brand,
  cookieName,
  detectLocale,
  direction,
  footer_about,
  footer_company,
  footer_contact,
  footer_copyright,
  footer_partners,
  footer_privacy,
  footer_sponsors_disclosed,
  footer_tagline,
  footer_terms,
  LOCALES,
  nav_communities,
  nav_login,
  nav_logout,
  type Locale,
} from '@founders-coffee/i18n'
import { configureClientLogger, logger, reportError } from '@founders-coffee/observability'
import { getVisibleMarkets } from '@founders-coffee/server-fns'

import { authClient } from '../lib/auth'

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

const LocaleToggle = ({ locale }: { locale: Locale }) => {
  const change = (l: Locale) => {
    document.cookie = `${cookieName}=${l}; path=/; max-age=31536000; samesite=lax`
    window.location.reload()
  }
  return (
    <div className="flex gap-1 rounded-field border border-base-300 bg-base-100 p-1">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => change(l)}
          className={`rounded-[calc(var(--radius-field)-0.25rem)] px-2 py-1 text-xs font-bold ${l === locale ? 'bg-neutral text-neutral-content' : 'text-base-content/40'}`}
        >
          {l === 'ar' ? 'ع' : l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

const LoginLink = ({ locale }: { locale: Locale }) => (
  <Link to="/login" className="text-sm text-primary hover:underline">
    {nav_login({}, { locale })}
  </Link>
)

const SessionNav = ({ locale }: { locale: Locale }) => {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <LoginLink locale={locale} />
  const { data: session } = authClient.useSession()
  if (!session) return <LoginLink locale={locale} />
  return (
    <button
      type="button"
      onClick={() => authClient.signOut()}
      className="text-sm text-base-content/70 hover:text-primary"
    >
      {nav_logout({}, { locale })}
    </button>
  )
}

const Navbar = () => {
  const { locale } = Route.useRouteContext()
  return (
    <nav className="sticky top-0 z-50 border-b border-base-300 bg-base-100/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link to="/" className="text-lg font-extrabold text-primary">
          {brand({}, { locale })}
        </Link>
        <SessionNav locale={locale} />
      </div>
    </nav>
  )
}

const Footer = () => {
  const markets = Route.useLoaderData()
  const { locale } = Route.useRouteContext()
  return (
    <footer className="mt-16 border-t border-base-300 bg-base-200">
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link to="/" className="text-lg font-extrabold text-primary">
              {brand({}, { locale })}
            </Link>
            <p className="mt-2 max-w-xs text-sm text-base-content/60">
              {footer_tagline({}, { locale })}
            </p>
          </div>
          <nav className="flex flex-col gap-2">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-base-content/40">
              {nav_communities({}, { locale })}
            </h2>
            {markets.map((mk) => (
              <Link
                key={mk.code}
                to="/$market"
                params={{ market: mk.slug }}
                className="text-sm text-base-content/60 hover:text-primary"
              >
                {mk.name}
              </Link>
            ))}
          </nav>
          <nav className="flex flex-col gap-2">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-base-content/40">
              {footer_company({}, { locale })}
            </h2>
            <a href="/about" className="text-sm text-base-content/60 hover:text-primary">
              {footer_about({}, { locale })}
            </a>
            <a href="/contact" className="text-sm text-base-content/60 hover:text-primary">
              {footer_contact({}, { locale })}
            </a>
            <a href="/privacy" className="text-sm text-base-content/60 hover:text-primary">
              {footer_privacy({}, { locale })}
            </a>
            <a href="/terms" className="text-sm text-base-content/60 hover:text-primary">
              {footer_terms({}, { locale })}
            </a>
          </nav>
          <div>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-base-content/40">
              {footer_partners({}, { locale })}
            </h2>
            <p className="text-sm italic text-base-content/50">
              {footer_sponsors_disclosed({}, { locale })}
            </p>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-base-300 pt-6">
          <p className="text-sm text-base-content/40">{footer_copyright({}, { locale })}</p>
          <LocaleToggle locale={locale} />
          <div className="flex gap-2">
            <a href="#" aria-label="X" className="btn btn-circle btn-ghost btn-sm">𝕏</a>
            <a href="#" aria-label="LinkedIn" className="btn btn-circle btn-ghost btn-sm">in</a>
            <a href="#" aria-label="reddit" className="btn btn-circle btn-ghost btn-sm">r/</a>
          </div>
        </div>
      </div>
    </footer>
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
        <Footer />
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
