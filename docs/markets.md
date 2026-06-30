# Markets — domain, queries, resolution

The market data-access + resolution layer. Implements **P1-001** (FR-G3/G4/G6, FR-L6), updated in
**P1-004** (cities → TS data) + **P1-005** (events). Splits across:

- **`libs/domain/src/markets/`** (pure) — state machine + locale resolution. Re-exported as the
  `markets` namespace (`import { markets } from '@founders-coffee/domain'`).
- **`libs/domain/src/geo/`** (pure) — the full geographic datasets (DZ 58 states + 1,541 cities, EG
  27 + 396, SA 13 + 4,581) as **server-side TS files**. Queried via `geo.getStates(country)`,
  `geo.getCities(country, stateCode)`, `geo.getFeaturedCities(country)`, `geo.findCityBySlug`.
- **`libs/db/src/markets.ts`** (data) — market queries only (D1). **Cities are NOT in D1** — the
  `cities` table was dropped (migration 0002).
- **`libs/server-fns/src/markets/`** (server) — resolution service composing db + domain geo.

## Resolution model

- **Market `code`/`slug` is the primary key** — resolved from a path (`/algeria`). Slug URLs are
  canonical (`/algeria`); code alias redirects (`/dz` → 307 `/algeria`).
- **3 target countries**: DZ (active), EG (active), SA (active). Morocco dropped. Adding a country
  is seed data (D1) + a geo TS data file (zero code in the resolver).
- **State visibility (FR-G3)**: `markets.isMarketVisible(state)` — `dark` hidden, `open`/`active`
  visible. Dark → `market_not_found` (no existence leak).
- **State machine**: `dark → open → active` (+ rollback) via `markets.transition`.
- **Arabic-first**: `detectLocale(cookie) → ar` (Accept-Language dropped — SRS §8.6 amended). The
  locale toggle (footer) is the only override.

## API

| Where | Export | Role |
|---|---|---|
| domain (`markets.*`) | `MarketState`, `canTransition`, `transition`, `isMarketVisible`, `VISIBLE_STATES` | pure state logic |
| domain (`geo.*`) | `getStates`, `getCities`, `getFeaturedCities`, `findCityBySlug`, `findCity`, `findState` | TS data queries |
| domain (`geo.*`) | `GeoState`, `GeoCity` types | `{ code, name, nameAr, slug?, stateCode, featured }` |
| db | `getMarketByCode`, `getMarketBySlug`, `listMarkets({states?})` | market queries only |
| server-fns | `resolveMarket(db, {code?, slug?})` | public market resolution |
| server-fns | `resolveMarketLanding(db, key)` | market + **featured cities** from geo TS data |
| server-fns | `resolveCityLanding(db, {marketKey, citySlug})` | market + city (validated via `geo.findCityBySlug`) |
| server-fns (RPC) | `getMarket`, `getMarketLanding`, `getCityLanding`, `getVisibleMarkets` | client-safe wrappers |
| server-fns (RPC) | `getStates`, `getCities`, `getFeaturedCities` | geo data RPCs |

## Geo-routing

`/` is never a page — it redirects to the visitor's market (CF-IPCountry or default Algeria) via
`getGeoCountry`. An `fc_geo` cookie remembers the resolution so the logo re-visits the same market.

## Notes
- **Geo data is server-side** (TS files in `libs/domain/src/geo/data/`). The client gets filtered
  subsets via RPCs — the full 6,518-city dataset never touches the browser bundle.
- **Featured cities** (state capitals) drive the landing page's city buttons. All cities are
  available in the onboarding/profile cascading picker.
- **Caching** — markets are near-static; reads D1 each call. An in-memory per-Worker cache (NOT KV
  — eventually consistent) is a later optimization for NFR-1's 300ms p95.
