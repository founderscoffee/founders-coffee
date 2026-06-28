# App wiring — `createStart`, env-injection, i18n

The P0-012 → **P1-017** linchpin: connecting the TanStack Start router to (a) global middleware,
(b) the Cloudflare Worker `env`, and (c) i18n locale detection. This doc covers **Phase A**
(the wiring that unblocks **P1-002** landing pages). Auth (Phase B) + observability/CSRF-origin
config (Phase C) are deferred.

## 1. `createStart` — `apps/ui/src/start.ts`

`createStart` is wired via a **convention file** — `src/start.ts` is auto-discovered by the
`tanstackStart()` vite plugin. The virtual `@tanstack/react-start/server-entry` `main` in
`wrangler.jsonc` stays as-is; no custom server entry.

```ts
export default createStart({
  requestMiddleware: [createCsrfMiddleware()],
  functionMiddleware: [requestContextMiddleware],
});
```

- **`createCsrfMiddleware()` is re-installed explicitly.** Defining `src/start.ts` *disables*
  TanStack's auto-installed CSRF middleware (and shows a dev warning). Re-adding it preserves the
  same-origin protection (`Sec-Fetch-Site`/`Origin`/`Referer`) on server-fns. Default origin = the
  incoming request URL (fine for `localhost` dev); explicit multi-domain prod origin = Phase C.
- **`requestContextMiddleware`** ([`libs/server-fns/src/request-context.ts`](../libs/server-fns/src/request-context.ts),
  type `'function'`) gives every server-fn a per-request id in the AsyncLocalStorage context the
  structured logger reads (AGENTS §13), and reports failures.

The same pattern applies to every app (`apps/dashboard`, `apps/admin`) when they wire up — each
gets its own `src/start.ts`.

## 2. Env-injection — `getDb()` via `cloudflare:workers`

Server-fns reach the D1 binding through the Workers runtime env, not a constructor arg:

```ts
// libs/server-fns/src/db.ts
import { env } from 'cloudflare:workers';
export const getDb = (): Db => createDb((env as { DB: D1Database }).DB);
```

- `cloudflare:workers`'s `env` is typed `Cloudflare.Env`. Apps generate `DB` on it via
  `wrangler types` (the gitignored `worker-configuration.d.ts`), but **the lib has no runtime
  wrangler**, so `getDb` narrows at the single call site (a self-contained cast — committing a
  generated `.d.ts` to the lib would make its typecheck depend on a gitignored file).
- **Every consuming app MUST declare a `DB` binding** in its `wrangler.jsonc` (`apps/ui` +
  `apps/worker-jobs` do; `apps/admin` follows). The markets RPC wrappers (`getMarket`,
  `getMarketCities`, `getVisibleMarkets` in [`libs/server-fns/src/markets/rpc.ts`](../libs/server-fns/src/markets/rpc.ts))
  call the db-injected resolver via `getDb()`, unwrapping the domain `Result` through `handleResult`
  (the throw boundary — AGENTS §7/§11.5).
- The RPC wrappers use `createServerFn({ strict: false })` because `Market.brandOverrides` is a
  JSON column typed `Record<string, unknown>` — runtime-serializable, but not provably so to TS.
  `zod` validators still run at runtime.

## 3. i18n — `<html lang dir>`

`__root`'s `beforeLoad` detects the locale once (at SSR — root is always active) and the document
shell renders it:

```ts
beforeLoad: () => {
  const value = getCookies()[cookieName];
  const cookieHeader = value ? `${cookieName}=${value}` : null;
  const accept = getRequestHeader('accept-language') ?? null;
  const locale = detectLocale(cookieHeader, accept);
  return { locale, dir: direction(locale) };
}
// RootDocument: <html lang={locale} dir={dir}>
```

- `getCookies`/`getRequestHeader` come from `@tanstack/react-start/server` (→
  `@tanstack/start-server-core/request-response`); they read the request at SSR.
- **Message rendering threads `{ locale }` explicitly** (`m.x({}, { locale })`) — the i18n design
  in [`libs/i18n/src/detect.ts`](../libs/i18n/src/detect.ts). No `paraglideMiddleware` / global
  `overwriteGetLocale` (sidesteps TanStack #6268 + the concurrent-request race). P1-002 threads
  `{locale}` into its messages; the locale value is already in the route context from `beforeLoad`.

## What's verified / what's deferred

**Verified (Phase A):** server boots clean; `<html lang="ar" dir="rtl">` renders for the default
locale; a route loader calling `getVisibleMarkets` reached the Miniflare D1 end-to-end
(`start.ts` discovery → `requestContextMiddleware` → CSRF → `getDb()` → `env.DB`). The "no such
table" D1 error in dev is expected — no migration is applied to the dev D1 yet (a `wrangler d1
migrations apply --local` step, or P0-021's auto-migrate test harness, closes that).

**Deferred:**
- **Phase B (auth)** — the `authMiddleware` / `requirePermission` middleware instances (built on
  P0-012's authz primitives), registered per-server-fn that touches private data.
- **Phase C (observability + CSRF origin)** — client `/client-logs` ingestion, `configureClientLogger`
  bootstrap, `reportError` into error boundaries (P0-014 app wiring); `createCsrfMiddleware({ origin })`
  prod config.

## Notes
- **#6223 (Arabic UTF-8 streaming SSR)** is **obsolete** — fixed in `react-start` ≥1.143.8; the
  installed version (1.168.26) is well past it. No streaming-SSR knob or `React.lazy` workaround
  is needed (the original P1-017 note assumed an older version).
- **`database_id`** in `apps/ui/wrangler.jsonc` is a placeholder until **P0-019** provisions the
  real D1 (dev/Miniflare works with any id; `wrangler deploy` is gated on P0-019).
