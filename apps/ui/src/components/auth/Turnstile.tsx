import { useEffect, useRef } from 'react';

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      action?: string;
      appearance?: 'always' | 'execute' | 'interaction-only';
      size?: 'normal' | 'flexible' | 'compact';
      callback: (token: string) => void;
      'error-callback': () => void;
      'expired-callback': () => void;
      'timeout-callback': () => void;
    },
  ) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

const getTurnstile = (): TurnstileApi | undefined =>
  (window as unknown as { turnstile?: TurnstileApi }).turnstile;

let loading: Promise<void> | null = null;
const loadTurnstile = (): Promise<void> => {
  if (getTurnstile()) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    if (existing) {
      if (getTurnstile()) resolve();
      else existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
  return loading;
};

export const Turnstile = ({
  sitekey,
  action,
  appearance = 'always',
  resetKey = 0,
  onToken,
}: {
  sitekey: string;
  action?: string;
  appearance?: 'always' | 'execute' | 'interaction-only';
  resetKey?: number;
  onToken: (token: string | null) => void;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    let cancelled = false;
    void loadTurnstile().then(() => {
      if (cancelled || !containerRef.current) return;
      const api = getTurnstile();
      if (!api) return;
      const resetWidget = () => {
        onTokenRef.current(null);
        if (widgetId.current) api.reset(widgetId.current);
      };
      widgetId.current = api.render(containerRef.current, {
        sitekey,
        action,
        appearance,
        size: 'flexible',
        callback: (token) => onTokenRef.current(token),
        'error-callback': resetWidget,
        'expired-callback': resetWidget,
        'timeout-callback': resetWidget,
      });
    });
    return () => {
      cancelled = true;
      const api = getTurnstile();
      if (widgetId.current && api) api.remove(widgetId.current);
    };
  }, [action, appearance, resetKey, sitekey]);

  return <div ref={containerRef} className="min-h-[65px]" />;
};
