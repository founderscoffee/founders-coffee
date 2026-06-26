# UI Design Specification — founders.coffee `apps/ui` (Public Events Feed)

| Field | Value |
|---|---|
| Document | UI Design Spec — public events feed |
| Version | 1.0 |
| Status | Clean — visual direction locked |
| Owner | Engineering / Design |
| Last updated | 2026-06-25 |
| Applies to | `apps/ui` public events feed → tokens in `libs/ui`, patterns in P1-002 / P1-007 |

> Visual direction for the public events feed. **Tokens live once in `libs/ui`** as a semantic DaisyUI theme; **component patterns feed P1-002** (landing + "be the first host" empty state) **and P1-007** (event list/detail). Global rules (AGENTS.md: real data / no mocks; NFR-8 accessibility; FR-S3 disclosed sponsorship) apply as usual and are not repeated here.

---

## 1. Theme — "Warm Café" (semantic tokens, defined once in `libs/ui`)

A DaisyUI custom theme. **Components use semantic classes only** (`bg-base-100`, `text-primary`, `border-base-300`, `bg-primary/10`, etc.) — **no raw palette or hex values in components** (AGENTS.md §8). Rebrand or dark mode = edit the theme once.

| Token | Value | Used for |
|---|---|---|
| `base-100` | `#FAF6F0` (warm cream) | Page background |
| `base-200` | `#FFFDFB` (off-white) | Cards / containers |
| `base-300` | `#EAE3D5` (soft beige) | Borders / dividers |
| `primary` | `#D97706` (coffee roast) | Accents, badges, focus ring |
| `secondary` | `#F59E0B` (amber) | Hover / secondary accent |

**Typography:** `Outfit` for headings, `Inter` for body (loaded once in the app shell). Weights: 400 body, 500 UI controls, 700 headings.

---

## 2. Layout

Editorial, single-column, centered feed — `max-w-3xl mx-auto` with generous vertical rhythm (`gap-y-8`).

```
+-----------------------------------------------------------+
| Navbar: Logo | Nav Links | Market/Locale Switcher         |
+-----------------------------------------------------------+
| Hero: "No-formalities" headline + short description       |
|   └─ Density badge (active builders per city)             |
+-----------------------------------------------------------+
| Filters: Cities (flags) · Topics · Date  (capsule chips)  |
+-----------------------------------------------------------+
| Tabs: [ All | Upcoming | Past ]                           |
+-----------------------------------------------------------+
| Event Feed: vertical stack of date-badge event cards      |
+-----------------------------------------------------------+
| Partner Venues grid: vetted café logos (grayscale→color)  |
+-----------------------------------------------------------+
```

---

## 3. Components

### 3.1 Hero + Density badge
Bold "no-formalities" headline + one-line description. A **live density badge** showing active builders per city — reinforces community credibility. (Real data only — AGENTS.md no-mocks.)

### 3.2 Filter chips (capsule)
`rounded-full` capsule buttons, grouped by **Cities** (with country flags), **Topics**, **Date**. Active state: `text-primary` on `bg-primary/10`. Mobile: horizontal scroll (`flex-nowrap overflow-x-auto scrollbar-none`).

### 3.3 Event card (the core feed)
Horizontal flex row:
- **Date badge (start):** stacked Month (small, uppercase) over Day (large) — `bg-primary/10 text-primary border border-base-300 rounded-lg`.
- **Middle:** Title (`font-bold text-lg`), start time, café name with a map-pin icon.
- **End:** overlapping avatar stack (`flex -space-x-2`, 3–4 avatars) + `"+N attending"` pill.
- **Hover:** `hover:-translate-y-0.5 hover:shadow-md transition-all duration-200`.

### 3.4 Partner venues grid
2×4 café logos, grayscale → full color on hover. Framed as **vetted partner venues** (the "Coffee Anchors" / Founder-Picks:venues surface — sponsorship plan SP-013).

---

## 4. RTL & responsive

- **Logical CSS properties only** (`ps-` / `pe-` / `ms-` / `me-`) — DaisyUI flips layout automatically under `dir="rtl"`, which is driven by the active market/locale (FR-L2).
- Date badge and avatar stack reflow to the correct side automatically via logical properties.
- **< 640px:** event card restacks vertically (date badge on top, info below) to maximise title space.

---

## 5. Where this lives

- **Tokens/theme** → `libs/ui` (single source of truth for all three apps).
- **Component patterns** → P1-002 (landing page + "be the first host" empty state) and P1-007 (event list/detail) acceptance criteria.
