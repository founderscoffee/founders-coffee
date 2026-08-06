import { useEffect, useRef } from 'react'

interface TurnstileApi {
  render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void }) => string
  remove: (id: string) => void
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

const getTurnstile = (): TurnstileApi | undefined =>
  (window as unknown as { turnstile?: TurnstileApi }).turnstile

let loading: Promise<void> | null = null
const loadTurnstile = (): Promise<void> => {
  if (loading) return loading
  loading = new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`)
    if (existing) {
      if (getTurnstile()) resolve()
      else existing.addEventListener('load', () => resolve())
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    document.head.appendChild(script)
  })
  return loading
}

export const Turnstile = ({
  sitekey,
  onToken,
}: {
  sitekey: string
  onToken: (token: string) => void
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken

  useEffect(() => {
    let cancelled = false
    void loadTurnstile().then(() => {
      if (cancelled || !containerRef.current) return
      const api = getTurnstile()
      if (!api) return
      widgetId.current = api.render(containerRef.current, {
        sitekey,
        callback: (token) => onTokenRef.current(token),
      })
    })
    return () => {
      cancelled = true
      const api = getTurnstile()
      if (widgetId.current && api) api.remove(widgetId.current)
    }
  }, [sitekey])

  return <div ref={containerRef} />
}
