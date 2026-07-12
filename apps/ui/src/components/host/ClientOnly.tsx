import { useEffect, useState, type ReactNode } from 'react'

/**
 * Renders `fallback` on the server (and during the first client pass), then `children` after mount.
 * Used to keep modules that touch browser-only globals (e.g. `@mapbox/search-js-react`, whose web
 * components reference `document` at import time) out of the SSR bundle entirely.
 */
export const ClientOnly = ({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) => {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return <>{mounted ? children : fallback}</>
}
