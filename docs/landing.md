# Landing pages — routing, data, i18n (revised IA)

**Revised IA (UI/UX batch):** there is **no global market-picker**. `/` redirects to the visitor's
market — detected via `CF-IPCountry`, defaulting to **Algeria**. The **country landing is the single
main page** (hero + aura cities + market-scoped discover tabs). Arabic is the default language
(`Accept-Language` dropped — SRS §8.6 amended). The Warm Café design system: Tajawal (Arabic),
paper-grain texture, daisyUI hover-3d + aura-glow, tabs-lift.

## Routing — geo-routing to default-Algeria, slug-canonical

**Locale is cookie-based, Arabic-first** (SRS §8.6 amended — `Accept-Language` is no longer
consulted; the locale toggle in the footer is the only override). The **market** is the path segment.

- **`/`** — never a page; redirects to the visitor's market ([`index.tsx`](../apps/ui/src/routes/index.tsx)):
  `getGeoCountry` (CF-IPCountry or DEV_GEO) → `getMarketLanding` → the market's slug, or default
  Algeria. An `fc_geo` cookie remembers the resolution so the logo (→ /) is stable.
- **`/{market}`** — country landing ([`$market/index.tsx`](../apps/ui/src/routes/$market/index.tsx)):
  hero + "Host in {market}" CTA + city buttons (name + event count + `aura-glow` if events>0) +
  discover tabs (Events/Hackathons, `tabs-lift`).
- **`/{market}/{city}`** — city landing ([`$market.$city.tsx`](../apps/ui/src/routes/$market.$city.tsx)):
  the polished "Be the first host" empty state (FR-E6).

**Slug URLs are canonical** (`/morocco`, `/morocco/casablanca`); the **code alias redirects**
(`/dz` → 307 `/algeria`). Each loader canonicalizes: if the path
segment isn't the resolved market's slug, `throw redirect(...)`. Resolution is slug-then-code
(`findMarketByKey` in [resolver.ts](../libs/server-fns/src/markets/resolver.ts)).

**`$market.tsx` is a layout (`<Outlet/>`), not a leaf.** Path hierarchy makes `/$market/$city` a child
of `/$market`, so the parent must render an `<Outlet/>` for the city route to show — a leaf component
on `$market.tsx` masks the child (a bug hit during the build). The country landing lives in
`$market/index.tsx`.

## Data flow — loaders → the P1-017 RPC

Each route's `loader` calls a `createServerFn` RPC (`getVisibleMarkets`/`getMarketLanding`/
`getCityLanding`) which unwraps the domain `Result` via `handleResult` (throw boundary). The loader
returns typed data; `useLoaderData()` consumes it. `market_not_found`/`city_not_found` → `throw
notFound()` → the router's `defaultNotFoundComponent` (dark markets + unknown/cross-market cities all
404 identically — no existence leak).

## i18n — explicit `{locale}` threading

Messages authored in [`libs/i18n/messages/{ar,en,fr}.json`](../libs/i18n/messages) (ar is base;
recompile via `nx generate-i18n i18n`). Every `m.x({}, { locale })` call threads the locale from
`__root`'s context (`useRouteContext()`). The **navbar locale toggle** sets `PARAGLIDE_LOCALE` +
reloads → `beforeLoad` re-resolves. **Edge pages** (404/error components) render in the base locale
(`ar`) — router-level components don't carry route context; dynamic localization is later polish.

## Empty state by design (FR-E6)

The city landing shows the **"Be the first to host in {city}"** empty state with a `/login` CTA
(forward-link to P1-003). **Events (FR-E5) don't exist until P1-005/P1-007** — so every city is
correctly empty now; the events feed slot is wired at P1-007. The "never looks dead" goal (FR-E6) is
met: emptiness reads as invitation, not abandonment.

## Build note — React dedupe

TanStack's `autoCodeSplitting` (default on) splits each route `component` into a separate chunk
(`?tsr-split=component`). Without `resolve.dedupe(['react','react-dom'])` in
[`vite.config.ts`](../apps/ui/vite.config.ts), the split chunk resolved `react` to a different
instance than `react-dom` → null dispatcher → "Invalid hook call" during SSR. (`__root`'s
`shellComponent` isn't split, so it worked — the bug only hit split route components.)

## Deferred

- **Density badge** ("active builders per city") → P1-004 (profiles) — no mocks.
- **Events feed** (FR-E5) → P1-005/P1-007.
- **Dynamic per-market brand theming** (`brandOverrides`) → later (DaisyUI theme is static).
- **Edge-page localization** (404/error in the active locale) → later polish.
- **Market/city name localization** (DB stores one `name`; ar users see Latin) → later (a `name_i18n`
  column or admin-managed aliases at P1-013).
