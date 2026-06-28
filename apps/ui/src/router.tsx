import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

import { logger, reportError } from '@founders-coffee/observability'

import { routeTree } from './routeTree.gen'

/**
 * Default error boundary for route render/load failures (client-side). `reportError` beacons through
 * the isomorphic `logger` → `/client-logs` → Workers Logs (AGENTS §13); SSR-side loader errors are
 * already reported by `requestContextMiddleware`. The UI is a minimal placeholder — P1-002 localizes
 * it via Paraglide once the message set exists.
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

export const getRouter = () => {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
