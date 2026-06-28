import handler from '@tanstack/react-start/server-entry';

import { createAuthHandler, type HandlerEnv } from '@founders-coffee/auth';

/**
 * Custom Workers entry for apps/ui. react-router 1.170.16 has no file-based API routes, so raw HTTP
 * endpoints mount here before the TanStack delegate:
 *   - `/api/auth/*` → Better Auth (createAuthHandler — per-request auth + Turnstile gating on the
 *     brute-force endpoints).
 *   - everything else → the TanStack Start server handler, which loads `src/start.ts` (CSRF +
 *     requestContextMiddleware) and serves SSR + server-fns. Those read the D1 binding through
 *     `cloudflare:workers` (`getDb`), not this `env` arg (AGENTS §11.5).
 */
export default {
  fetch: async (request: Request, env: HandlerEnv): Promise<Response> => {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/auth/')) return createAuthHandler(env)(request);
    return handler.fetch(request);
  },
} satisfies ExportedHandler<HandlerEnv>;
