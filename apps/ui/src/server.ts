import handler from '@tanstack/react-start/server-entry';

import { createAuthHandler, type HandlerEnv } from '@founders-coffee/auth';
import { ingestClientLogs, type LogEntry } from '@founders-coffee/observability';

/**
 * Custom Workers entry for apps/ui. react-router 1.170.16 has no file-based API routes, so raw HTTP
 * endpoints mount here before the TanStack delegate:
 *   - `POST /client-logs` → `ingestClientLogs` (re-emits through the server console transport →
 *     Workers Logs/Logpush, the same stream as server logs). Basic shape validation only;
 *     Durable-Object rate limiting lands at P1-018.
 *   - `/api/auth/*` → Better Auth (createAuthHandler — per-request auth + Turnstile gating on the
 *     brute-force endpoints).
 *   - everything else → the TanStack Start server handler, which loads `src/start.ts` (CSRF +
 *     requestContextMiddleware) and serves SSR + server-fns. Those read the D1 binding through
 *     `cloudflare:workers` (`getDb`), not this `env` arg (AGENTS §11.5).
 */
export default {
  fetch: async (request: Request, env: HandlerEnv): Promise<Response> => {
    const url = new URL(request.url);
    if (url.pathname === '/client-logs' && request.method === 'POST') {
      const body = (await request.json().catch(() => null)) as { entries?: unknown } | null;
      if (body && Array.isArray(body.entries)) ingestClientLogs(body.entries as LogEntry[]);
      return new Response(null, { status: 204 });
    }
    if (url.pathname.startsWith('/api/auth/')) return createAuthHandler(env)(request);
    return handler.fetch(request);
  },
} satisfies ExportedHandler<HandlerEnv>;
