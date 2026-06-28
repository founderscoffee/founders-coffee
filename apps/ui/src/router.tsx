import { Link, createRouter as createTanStackRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

import { back_home, not_found_body, not_found_title } from '@founders-coffee/i18n'
import { logger, reportError } from '@founders-coffee/observability'

import { routeTree } from './routeTree.gen'

/**
 * Default error boundary for route render/load failures (client-side). `reportError` beacons through
 * the isomorphic `logger` → `/client-logs` → Workers Logs (AGENTS §13); SSR-side loader errors are
 * already reported by `requestContextMiddleware`.
 */
const DefaultErrorComponent = ({ error }: { error: unknown }) => {
  useEffect(() => {
    reportError(error, { source: 'route' }, logger)
  }, [error])

  return (
    <div className="p-8" dir="rtl">
      <h1 className="text-2xl font-bold">حدث خطأ ما</h1>
      <p className="mt-2 text-sm">يرجى إعادة تحميل الصفحة</p>
    </div>
  )
}

/**
 * Default 404 for unmatched routes + `notFound()` thrown by loaders (dark/unknown market, cross-market
 * city). Rendered in the base locale (ar) — router-level components don't carry route context, and 404s
 * are rare edge pages; localizing them dynamically is later polish.
 */
const DefaultNotFoundComponent = () => (
  <div className="p-8 text-center" dir="rtl">
    <h1 className="text-2xl font-bold text-primary">{not_found_title({}, { locale: 'ar' })}</h1>
    <p className="mt-2 text-sm text-base-content/70">{not_found_body({}, { locale: 'ar' })}</p>
    <Link to="/" className="mt-4 inline-block link link-hover text-primary">
      {back_home({}, { locale: 'ar' })}
    </Link>
  </div>
)

export const getRouter = () => {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
    defaultNotFoundComponent: DefaultNotFoundComponent,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
