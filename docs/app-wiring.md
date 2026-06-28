# App wiring — `createStart`, custom entry, env-injection, i18n, auth, observability

The P0-012 → **P1-017** linchpin: connecting the TanStack Start router to (a) global middleware,
(b) the Cloudflare Worker `env`, (c) i18n locale detection, (d) Better Auth, and (e) the client→server
log stream. **Phase A + B + C are complete.** Only the `ANALYTICS` binding + prod CSRF origin remain
(P0-019 / deploy).

## 1. `createStart` — `apps/ui/src/start.ts`

`createStart` is wired via a **convention file** — `src/start.ts` is auto-discovered by the
`tanstackStart()` vite plugin. It takes a `() => options` callback (not an options object):

```ts
export default createStart(() => ({
  requestMiddleware: [createCsrfMiddleware()],
  functionMiddleware: [requestContextMiddleware],
}));
```

- **`createCsrfMiddleware()` is re-installed explicitly.** Defining `src/start.ts` *disables*
  TanStack's auto-installed CSRF middleware (and shows a dev warning). Re-adding it preserves the
  same-origin protection on server-fns. Default origin = the request URL (fine for dev); explicit
  multi-domain prod origin is configured at deploy.
- **`requestContextMiddleware`** ([`libs/server-fns/src/request-context.ts`](../libs/server-fns/src/request-context.ts))
  gives every server-fn a per-request id in the AsyncLocalStorage context the structured logger
  reads (AGENTS §13), and reports failures (SSR loader errors included).

## 2. Custom Workers entry — `apps/ui/src/server.ts`

react-router 1.170.16 has **no file-based API routes** (`createAPIFileRoute`/`createServerRoute`), so
raw HTTP endpoints mount in a custom Workers entry (apps/admin's proven pattern) that delegates
everything else to the TanStack server handler. `wrangler.jsonc` `main` → `src/server.ts`:

```ts
export default {
  fetch: async (request, env) => {
    const url = new URL(request.url);
    if (url.pathname === '/client-logs' && request.method === 'POST') { /* ingestClientLogs */ }
    if (url.pathname.startsWith('/api/auth/')) return createAuthHandler(env)(request);
    return handler.fetch(request);  // SSR + server-fns — loads start.ts; getDb reads cloudflare:workers
  },
} satisfies ExportedHandler<HandlerEnv>;
```

The virtual `@tanstack/react-start/server-entry` (imported as `handler`) still loads `start.ts`, so
CSRF + `requestContextMiddleware` apply to TanStack-handled requests; the raw endpoints bypass them
(correct — they're not server-fns). Verified: the custom-entry switch did not regress `start.ts` or
`getDb` (a route loader still reached D1 through it).

## 3. Env-injection — `getDb()` via `cloudflare:workers`

Server-fns reach the D1 binding through the Workers runtime env, not a constructor arg:

```ts
// libs/server-fns/src/db.ts
import { env } from 'cloudflare:workers';
export const getDb = (): Db => createDb((env as { DB: D1Database }).DB);
```

- `cloudflare:workers`'s `env` is typed `Cloudflare.Env`. Apps generate `DB` on it via
  `wrangler types` (the gitignored `worker-configuration.d.ts`), but **the lib has no runtime
  wrangler**, so `getDb` narrows at the single call site.
- **Every consuming app MUST declare a `DB` binding** (`apps/ui` + `apps/worker-jobs` do). The markets
  RPC wrappers ([`libs/server-fns/src/markets/rpc.ts`](../libs/server-fns/src/markets/rpc.ts)) call the
  db-injected resolver via `getDb()`, unwrapping `Result` through `handleResult` (the throw boundary).
  `strict: false` because `Market.brandOverrides` (`Record<string, unknown>`) isn't provably serializable.

## 4. i18n — `<html lang dir>`

`__root`'s `beforeLoad` detects the locale once (at SSR) and the document shell renders it. Message
rendering threads `{ locale }` explicitly (`m.x({}, { locale })`) — no global runtime state
(sidesteps TanStack #6268 + the concurrent-request race). P1-002 threads `{locale}` into messages.

## 5. Auth — `authMiddleware` + `requirePermission` (Phase B)

Better Auth mounts at `/api/auth/*` in the custom entry (`createAuthHandler(env)` — per-request auth +
Turnstile gating on the brute-force endpoints). The server-fn primitives live in
[`libs/server-fns/src/auth.ts`](../libs/server-fns/src/auth.ts) + [`auth-middleware.ts`](../libs/server-fns/src/auth-middleware.ts):

- **`authMiddleware`** — constructs Better Auth per request (`createAuth(getAuthEnv())`), resolves the
  session from the request headers, attaches `session` (null if anon) to context. Composed **per-fn**
  that needs identity — NOT global, so public RPCs (markets resolver) stay anonymous.
- **`requirePermission(resource, action)`** — middleware factory (composing `authMiddleware`) that
  throws `AppError('unauthenticated'|'forbidden')` at the data boundary:
  `createServerFn().middleware([requirePermission('event', 'create')])` (AGENTS §11.2 — the data
  boundary, not just a route guard).

`getAuthEnv` narrows `cloudflare:workers` env to `AuthEnv` (DB + `BETTER_AUTH_SECRET` + `APP_URL`).
Dev needs `apps/ui/.dev.vars` (BETTER_AUTH_SECRET) + local D1 migrations
(`wrangler d1 migrations apply founders-coffee --local`); prod D1 + real secret land at P0-019.

## 6. Observability — `/client-logs` + client logger + `reportError` (Phase C)

- **`POST /client-logs`** (custom entry) → `ingestClientLogs` re-emits entries through the server
  console transport → Workers Logs/Logpush (the same stream as server logs; sanitizes again
  server-side). Basic shape validation only — Durable-Object rate limiting is **P1-018**.
- **Client bootstrap** (`__root` `useClientObservability`) — `configureClientLogger({ endpoint: '/client-logs' })`
  + window `error`/`unhandledrejection` → `reportError(..., logger)` (beacons via the isomorphic logger).
- **Route errors** — `router.tsx` `defaultErrorComponent` calls `reportError` (client render errors);
  SSR loader errors are already reported by `requestContextMiddleware`. `createStart` has no `onError`,
  so this is the catch. (Minimal placeholder UI — P1-002 localizes it.)

## What's verified / what's deferred

**Verified (dev smoke):** `<html lang="ar" dir="rtl">`; `POST /client-logs` → 204 (entry re-emitted
through the transport); `/api/auth/ok` → `{"ok":true}` (Better Auth mounted); the markets RPC returns
through the custom entry (`start.ts` + `getDb` unregressed); server-fns tests green (incl.
`resolveSession` + authz).

**Deferred (P0-019 / deploy):**
- **`ANALYTICS` binding** — product metrics (Analytics Engine); NOT needed for the log stream.
- **CSRF prod origin** — `createCsrfMiddleware({ origin })` for prod domains.
- **Real D1 + `BETTER_AUTH_SECRET`** — prod sessions need P0-019 (dev uses local Miniflare D1 + `.dev.vars`).

## Notes
- **#6223 (Arabic UTF-8 streaming SSR)** is **obsolete** — fixed in `react-start` ≥1.143.8; installed
  is 1.168.26. No streaming-SSR knob or `React.lazy` workaround is needed.
- **`database_id`** in `apps/ui/wrangler.jsonc` is a placeholder until **P0-019** provisions the real D1.
- **`/server` import isolation** — `@tanstack/react-start/server` transitively loads `createStartHandler`
  (a vite-plugin virtual entry) the vitest pool can't resolve; the server-fns lib keeps that import in
  `auth-middleware.ts` only, so the pool-tested `resolveSession` (`auth.ts`) stays clean.
