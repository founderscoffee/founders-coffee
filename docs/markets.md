# Markets — domain, queries, resolution

The architecture remains multi-market, but the [current release](./release-strategy.md) is
Algeria-first with an operational focus on Algiers. Configured future markets do not authorize
seeding, launch operations, or expansion before the community validation gate.

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

- **Market `code` is the D1 primary key; `slug` is the canonical URL key** — resolved from a path (`/algeria`). Slug URLs are
  canonical (`/algeria`); code alias redirects (`/dz` → 307 `/algeria`).
- **Canonical market policy**: DZ (`active`), EG/SA (`open`), MA/AE (`dark`). The current seed still
  marks DZ/EG/SA `active` and does not include MA/AE, so P0-007 remains blocked until code and deployed
  rows are aligned. Geography datasets currently exist for DZ/EG/SA. Adding or correcting state/city
  data requires a reviewed dataset change and deployment; market visibility and feature activation
  remain D1 configuration.
- **State visibility (FR-G3)**: `markets.isMarketVisible(state)` — `dark` hidden, `open`/`active`
  visible. Dark → `market_not_found` (no existence leak).
- **State machine**: `dark → open → active` (+ rollback) via `markets.transition`.
- **Arabic-first**: preference/cookie → market default → `ar`; supported locales are `ar`, `fr`,
  and `en`. Browser `Accept-Language` does not override the selected locale.

## API

| Where                | Export                                                                                   | Role                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| domain (`markets.*`) | `MarketState`, `canTransition`, `transition`, `isMarketVisible`, `VISIBLE_STATES`        | pure state logic                                                                             |
| domain (`geo.*`)     | `getStates`, `getCities`, `getFeaturedCities`, `findCityBySlug`, `findCity`, `findState` | TS data queries                                                                              |
| domain (`geo.*`)     | `GeoState`, `GeoCity` types                                                              | `{ code, name, nameAr, slug, stateCode, featured }` for cities; states omit city-only fields |
| db                   | `getMarketByCode`, `getMarketBySlug`, `listMarkets({states?})`                           | market queries only                                                                          |
| server-fns           | `resolveMarket(db, {code?, slug?})`                                                      | public market resolution                                                                     |
| server-fns           | `resolveMarketLanding(db, key, pagination?)`                                             | market + **featured cities** from geo TS data + cursor page                                  |
| server-fns           | `resolveCityLanding(db, {marketKey, citySlug}, pagination?)`                             | market + city (validated via `geo.findCityBySlug`) + cursor page                             |
| server-fns (RPC)     | `getMarket`, `getMarketLanding`, `getCityLanding`, `getVisibleMarkets`                   | client-safe wrappers                                                                         |
| server-fns (RPC)     | `getStates`, `getCities`, `getFeaturedCities`                                            | geo data RPCs                                                                                |

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
