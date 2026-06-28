# Markets — domain, queries, resolution

The market/city data-access + resolution layer — the P1 foundation. Implements **P1-001** (FR-G3/G4/G6, FR-L6). Splits across three places under the "no new libs" rule:

- **`libs/domain/src/markets/`** (pure) — state machine + locale/host resolution. Re-exported from the domain barrel as the `markets` namespace (`import { markets } from '@founders-coffee/domain'`).
- **`libs/db/src/markets.ts`` (data) — market/city queries. The data layer owns no visibility rule.
- **`libs/server-fns/src/markets/`** (server) — the resolution service that composes db + domain.

## Resolution model

- **Market `code`/`slug` is the primary key** — resolved from a path (`/morocco`) or host. **Locale is derived, never the lookup key**: `ar` maps to both DZ and MA, so locale→market is ambiguous. FR-L6: a market's locale *is* `Market.default_locale`; the cookie can override it via `markets.resolveLocaleFor(defaultLocale, cookieLocale?)`.
- **State visibility (FR-G3)**: `markets.isMarketVisible(state)` — `dark` hidden, `open`/`active` visible; `markets.VISIBLE_STATES = ['open','active']`. The public resolver hides dark markets (`market_not_found`, no existence leak); admin (P1-013) sees all.
- **Data-driven (FR-G4)**: resolvers query D1 — no hardcoded market list. Adding EG/SA/AE is seed data, zero code.
- **State machine**: `dark → open → active` (+ `open → dark`, `active → open` rollback) via `markets.transition`. The pure validator lives in domain; the admin mutation UI is P1-013.
- **Routing-agnostic**: P1-001 provides resolvers for *either* path-prefix (`/dz`) or cookie-locale. The routing choice (the SRS is inconsistent: §8.6 cookie/no-prefix vs §9 `/dz` path-prefix) is P1-002/P1-017. `markets.parseMarketCodeFromHost` is an optional subdomain helper (no SRS commitment).

## API

| Where | Export | Role |
|---|---|---|
| domain (`markets.*`) | `MarketState`, `canTransition`, `transition`, `isMarketVisible`, `VISIBLE_STATES` | pure state logic |
| domain (`markets.*`) | `resolveLocaleFor(default, cookie?)` | FR-L6 locale derivation |
| domain (`markets.*`) | `parseMarketCodeFromHost(hostname)` | optional subdomain parser |
| db | `getMarketByCode`, `getMarketBySlug`, `listMarkets({states?})`, `listCitiesByMarket`, `getCityBySlug(marketCode, slug)` | generic queries |
| server-fns | `resolveMarket(db, {code?, slug?})` | public resolution (dark hidden) |
| server-fns | `getMarketWithCities(db, code)` | market + cities (FR-G6) |
| server-fns | `listVisibleMarkets(db)` | open + active only |

## The env-injection split

The resolver is **db-injected** (`db: Db` first arg), so it's fully testable now against real Miniflare D1. The `createServerFn` RPC wrappers (which read `env.DB` via `getDb()`) land at **P1-017** with env-injection — the apps' `server.ts` bridges the Worker env into the request context. No stubs: everything in P1-001 is real + tested; P1-017 adds the thin RPC shell.

```ts
// P1-017 wrapper (future):
export const getMarket = createServerFn().handler(async ({ data }) =>
  handleResult(resolveMarket(getDb(), { code: data.code })),
);
```

## Consumers + notes
- **P1-005** events, **P1-004** profiles, **P1-013** admin — all resolve via this service.
- **City slug is not globally unique** — `getCityBySlug` takes `(marketCode, slug)`.
- **Caching** — markets/cities are near-static; this reads D1 each call. An in-memory per-Worker cache (NOT KV — eventually consistent) is a later optimization for NFR-1's 300ms p95.
