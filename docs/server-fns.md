# Server functions — the backend (`libs/server-fns`)

For the [community-building release](./release-strategy.md), active product functions serve auth,
profiles, markets, free events, RSVP, trust/moderation, notifications, and their operations.
Foundations or types for future product layers do not make those layers current scope.

The backend of founders.coffee is **server functions** (`createServerFn` from `@tanstack/react-start`),
all defined in `libs/server-fns` and consumed by every app via the client-safe barrel. Implements
AGENTS.md §7.

## Modules

| Module                                 | What                                                                                                                                                                  | Status                                                         |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `request-context.ts`                   | `requestContextMiddleware` (per-request id via ALS + failure logging), `withRequestContext`                                                                           | ✅ P0-012                                                      |
| `authz.ts`                             | `checkPermission`, `requireAuth`, `requirePermission` (pure RBAC checks)                                                                                              | ✅ P0-012                                                      |
| `auth.ts`                              | `getAuthEnv`, `resolveSession` (pure — no `/server` import; pool-testable)                                                                                            | ✅ P1-017                                                      |
| `auth-middleware.ts`                   | `authMiddleware` (per-request session), `requirePermission(resource, action)` factory — carries `@tanstack/react-start/server` (isolated from the barrel)             | ✅ P1-017                                                      |
| `db.ts`                                | `getDb()` — env-injection via `cloudflare:workers` (the P1-017 solution)                                                                                              | ✅ P1-017                                                      |
| `geo.ts`                               | `getGeoCountry` — CF-IPCountry + DEV_GEO fallback                                                                                                                     | ✅ P1-017                                                      |
| `geo-rpc.ts`                           | `getStates`, `getCities`, `getFeaturedCities` — delegate to domain geo                                                                                                | ✅ P1-004                                                      |
| `auth-config.ts`                       | `getPublicAuthConfig` — Turnstile sitekey + OAuth availability                                                                                                        | ✅ P1-003                                                      |
| `profile.ts`                           | `getMyProfile` (authed), `setHomeLocation` (validated + D1 write), `getPublicProfile` (public, FR-E7)                                                                 | ✅ P1-004                                                      |
| `markets/resolver.ts`                  | `resolveMarket`, cursor-aware `resolveMarketLanding` (+ featured cities from geo), cursor-aware `resolveCityLanding` (via `geo.findCityBySlug`), `listVisibleMarkets` | ✅ P1-001/004 · SEO-08                                         |
| `markets/rpc.ts`                       | `getMarket`, `getMarketLanding`, `getCityLanding`, `getVisibleMarkets`                                                                                                | ✅ P1-001/017                                                  |
| `events/status-machine.ts`             | `published ↔ cancelled` transitions                                                                                                                                   | ✅ P1-005                                                      |
| `events/resolver.ts`                   | `createEventResolver` (validates geo + generates slug), `resolveEvent`, `listEvents`                                                                                  | ✅ P1-005                                                      |
| `events/rpc.ts`                        | `createEvent` (POST + authz + DO limit + WAF gate + Turnstile + Zod), `getEvent`, cursor-aware `getUpcomingEvents`, `getHostedEvents`                                 | ✅ EC-05/06; shared Free-plan WAF active · SEO-08              |
| `rsvps/*`                              | RSVP/cancellation RPCs, RSVP counters, and notification production                                                                                                    | Blocked: full-capacity atomicity defect in the repository path |
| `waitlist/*`                           | Anonymous waitlist signup and lookup flow                                                                                                                             | Implemented                                                    |
| `notifications/producer.ts`            | Persists confirmation/reminder work                                                                                                                                   | Partial: current worker polls D1; migrate to DO alarms → Queue |
| `push/rpc.ts` / `config.ts`            | Authenticated FCM token registration/removal and public PWA configuration                                                                                             | Implemented; production credentials unverified                 |
| `rate-limit.ts` / `rate-limiter-do.ts` | Durable Object rate-limit middleware and shared RPC class                                                                                                             | ✅ Event creation; remaining mutation audit under P1-018       |
| `turnstile/*`                          | Siteverify provider, development runtime, deployed fail-closed WAF contract, and event-create middleware                                                              | ✅ EC-06; both Worker evidence markers active                  |

## The hybrid error model

- **`libs/domain`** returns `Result<T>` (`{ ok, data } | { ok: false, error }`). Pure — no throws.
- **`libs/server-fns`** unwraps via `handleResult()` — **throws `AppError` on `!ok`**, returns data on `ok`.
- TanStack Start serializes the thrown `AppError.code` across the wire → `useQuery`/loaders enter
  their error state automatically.
- Read the stable `code` client-side: `appErrorCode(error)` (the [#6428] typing gap).

## The client-safe barrel (`libs/server-fns/src/index.ts`)

Exports ONLY: `createServerFn` RPC wrappers, types, and pure helpers. **Server-only internals**
(`getDb`, `authMiddleware`, `getAuthEnv`, `resolveSession`) are NOT re-exported — they'd drag
`cloudflare:workers` / `@tanstack/react-start/server` into the browser bundle (the P1-003 barrel fix).

## RBAC

`member` can `event:create` (any logged-in user can host — P1-006). The `host` role stays for
future use (verified-host badges). `requirePermission('event', 'create')` still gates the RPC.

[#6428]: https://github.com/TanStack/router/issues/6428
