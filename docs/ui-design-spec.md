# UI Design Specification — founders.coffee `apps/ui`

> Visual direction for the public app. **Tokens live once in `libs/ui`** as a semantic DaisyUI
> theme; **component patterns feed P1-002** (landing pages), **P1-006** (event creation), and
> **P1-007** (event list/detail). Global rules (AGENTS.md: real data / no mocks; NFR-8
> accessibility; FR-S3 disclosed sponsorship) apply as usual.

---

## 1. Theme — "Warm Café" (semantic tokens, defined once in `libs/ui`)

A DaisyUI custom theme + **paper grain** texture (a faint SVG noise on the body background).
**Components use semantic classes only** (`bg-base-100`, `text-primary`, `border-base-300`,
`bg-primary/10`) — **no raw palette or hex values in components** (AGENTS.md §8).

| Token | Value | Used for |
|---|---|---|
| `base-100` | `#FAF6F0` (warm cream) | Page background (with grain overlay) |
| `base-200` | `#FFFDFB` (off-white) | Cards / containers |
| `base-300` | `#EAE3D5` (soft beige) | Borders / dividers |
| `primary` | `#B45309` (coffee roast, AA) | Accents, badges, focus ring |
| `secondary` | `#F59E0B` (amber) | Hover / secondary accent |

**Typography:** `Outfit` for headings + `Inter` for body (self-hosted via `@fontsource-variable`).
`Tajawal` for Arabic (the fonts stack has it as a fallback after the Latin face — per-glyph
selection). Weights: 400 body, 500 UI, 700 headings, 800 hero.

---

## 2. Layout

The revised IA (P1-004): **no global picker**. `/` redirects to the visitor's market
(geo-routing). The **country landing is the main page**.

```
+-----------------------------------------------------------+
| Navbar: Logo                              [Sign in/user]   |  ← sticky, translucent
+-----------------------------------------------------------+
| Hero: market badge + title + tagline + [Host in {market}] |  ← warm radial glow
|   Cities: [Algiers · 0] [Oran · 0] …                     |  ← aura-glow when events>0
+-----------------------------------------------------------+
| Discover tabs (tabs-lift): [Events to discover] [Hackathons] |
|   Event Feed: vertical stack of hover-3d event cards      |
+-----------------------------------------------------------+
| Footer: brand | Communities | Company/Legal | Partners     |  ← locale toggle lives here
|   © 2026 founders.coffee   [ع EN FR]   [𝕏] [in] [r/]      |
+-----------------------------------------------------------+
```

---

## 3. Components

### 3.1 Hero
Market badge (`badge badge-outline badge-primary`) + editorial title (`market_hero_title`) +
tagline + **"Host in {market}"** CTA (`btn btn-primary shadow-lg shadow-primary/30`). A warm
radial-glow div sits behind the hero (`-z-10`). Featured cities render as buttons with a count
badge (`badge badge-sm`); **aura-glow** wraps buttons whose market has events (count > 0).

### 3.2 Event card (`EventCard.tsx`)
720×150, `card-side`, wrapped in **Hover3D** (daisyUI `.hover-3d` with 8 zone overlays for
tilt + shine). Left: date widget (`THU` accent / `2` large / `JUL`). Body: title
(`font-bold`) + metadata (`time · venue, city`) + avatar-group (`avatar-placeholder` initials)
+ `+N going`.

### 3.3 City empty state (`CityLanding.tsx`)
☕ icon + "Be the first to host in {city}" + value bullets (List the meetup · Pick a café ·
Set the time) + **"Host the first meetup"** CTA → `/login` + back-to-market link.

### 3.4 Host create wizard (`HostCreatePage.tsx`)
3-step wizard (daisyUI `steps`) implementing **progressive disclosure** (see
[`docs/psy.md`](./psy.md)):
- Step 1 "Where?" — cascading country/state/city select + **Mapbox map picker** (browser
  geolocation → `flyTo`, café search via Search Box API, DOM coffee marker).
- Step 2 "When?" — **vanilla-calendar-pro** (daisyUI-themed, 24h time picker) + capacity select.
- Step 3 "What?" — title (casual placeholder: "Coffee + code, or just coffee?"), description,
  language enum, category enum → `createEvent` RPC.

Lazy-loaded: mapbox-gl (~700KB) + vanilla-calendar-pro never touch the initial bundle.

### 3.5 Navbar + Footer
- **Navbar**: sticky, translucent (`backdrop-blur`), logo + `SessionNav` only. No Communities,
  no locale toggle (both moved to the footer).
- **Footer**: brand + Communities (data-driven market links) + Company/Legal (forward-ref anchors)
  + Partners (FR-S3 disclosed sponsors) + locale toggle + social (X, LinkedIn, reddit).

### 3.6 Error / 404 states
Locale-aware (via `useRouterState` reading the root match's context). 404: ☕ icon +
`not_found_title/body` + "Back home". Error: ⚠️ + `error_title/body` + "Back home" (no reload).

---

## 4. RTL & responsive

- **Logical CSS properties only** (`ps-` / `pe-` / `ms-` / `me-`) — DaisyUI flips under `dir="rtl"`.
- **Arabic-first** — `<html lang="ar" dir="rtl">` is the default; `en`/`fr` are selectable via
  the footer toggle.
- **< 640px:** event card restacks vertically; wizard steps remain; map height shrinks to 250px.

---

## 5. Where this lives

- **Tokens/theme + grain** → `libs/ui/src/styles.css` (single source of truth).
- **Shared components** → `apps/ui/src/components/` (PascalCase: `EventCard.tsx`, `MapPicker.tsx`,
  `Navbar.tsx`, etc.).
- **Route files** → thin: `createFileRoute` + loader + `<Component />`. No inline component logic.
- **Design reference** → [`docs/psy.md`](./psy.md) (progressive disclosure, casual copy).
