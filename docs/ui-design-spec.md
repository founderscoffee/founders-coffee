# UI Design Specification — founders.coffee `apps/ui`

> Visual direction for the public app. **Tokens live once in `libs/ui/src/styles.css`** as a
> semantic DaisyUI theme. This specification covers the
> [community-building release](./release-strategy.md): member, host, and free local-event surfaces
> only. Sponsor, challenge, talent, payment, and expansion UI remains future work.
>
> Adopted from the "Round Table" Claude Design handoff on 2026-09-04, replacing the "Warm Café"
> identity (cup + script logo, brown-on-brown, hover-3d/aura/glow effects, paper grain).

---

## 1. Theme — "Round Table" (semantic tokens, defined once in `libs/ui`)

**Components use semantic classes only** (`bg-base-100`, `text-neutral`, `border-base-300`,
`text-accent`) — **no raw palette or hex values in components** (AGENTS.md §8). The one raw hex in
the app is the `theme-color` meta tag, which colours browser chrome rather than a component.

| Token          | Value                 | Used for                                         |
| -------------- | --------------------- | ------------------------------------------------ |
| `base-100`     | `#FFFCF7` (paper)     | Page background, cards                           |
| `base-200`     | `#F3EBDD` (linen)     | Tinted surfaces, date tiles, chips, footer       |
| `base-300`     | `#E6DCCB` (sand)      | Borders, dividers, disabled fill                 |
| `base-content` | `#270F00` (roast)     | Text — 17.8:1 on paper                           |
| `primary`      | `#270F00` (roast)     | Primary button, active nav, links                |
| `secondary`    | `#B4562E` (clay)      | Accent, chair dot, focus ring, the one CTA       |
| `accent`       | `#9A4423` (clay-deep) | Clay **as text** on light surfaces (6.4:1)       |
| `neutral`      | `#6B5B50` (mocha)     | Secondary text — 6.3:1                           |
| `taupe`        | `#9A8676`             | Eyebrow labels, icons, placeholders — never body |

Status colours pass AA on paper **and** on their own tint: `info #2F5F8A`, `success #276B44`,
`warning #84590D`, `error #B3261E`, each with a `*-tint` surface fill.

**Radii** 6px selector / 8px field / 12px box. **Border** 1px sand. **`--depth: 0`, `--noise: 0`** —
no bevel, no grain. **Focus** 2px clay, offset 2. **Motion** 120/200/320ms on
`cubic-bezier(.2,.8,.2,1)`, all of it inside a `prefers-reduced-motion` guard.

**Typography:** `Outfit` display + `Inter` body (self-hosted via `@fontsource-variable`), `Tajawal`
for Arabic at 1.65 line-height with letter-spacing zeroed. Weights: 400 body, 500 UI, 600 display,
700 Arabic headings. The type scale is tokenised (`text-display` … `text-overline`); components use
those names rather than `text-3xl`.

**Dark theme.** A "roast" palette exists in the handoff and is deliberately **not shipped**. It
carries `prefersdark: true`, which is not "disabled" — it would go live for every viewer whose OS
prefers dark, on a design measured only in light.

---

## 2. Layout

The revised IA (P1-004): **no global picker**. `/` redirects to the visitor's market (geo-routing).
The **market landing is the main page**.

```
+-----------------------------------------------------------+
| Navbar: lockup                            [Sign in/avatar] |  ← sticky, solid paper, 1px sand
+-----------------------------------------------------------+
| Hero: display title + subtitle + pill search [Find a meetup]|
|   Cities: [Algiers 3] [Oran] …                             |  ← flat linen chips, clay count
+-----------------------------------------------------------+
| Discover tabs (bordered): [Events] [Workshops]             |
|   Event feed: bordered cards, hover = shadow-2             |
+-----------------------------------------------------------+
| Footer (linen): brand + locales | Communities | Company | Legal |
+-----------------------------------------------------------+
```

---

## 3. Components

### 3.1 Hero (`MarketHero.tsx`)

Display-size title in Outfit 600, subtitle in mocha, and a **pill search** — `h-12 md:h-14`,
`rounded-full`, 1px sand, clay border on focus-within — with the CTA as a `rounded-full` roast
button **inside** it at inline-end. No radial glow, no drop shadow.

### 3.2 Event card (`EventCard.tsx`)

Bordered card on paper, `rounded-box`, hover raises `--shadow-2` and nothing else. Linen date tile
(weekday / day / month, the weekday and month as eyebrows). Body: title, `time · venue, city`, and
a footer row with `+N going` and the capacity chip.

The capacity chip reads `event.remaining`, which `EventAttendance` computes as `capacity - rsvps`
and leaves `null` when uncapped: `> 0` renders `chairs_left` on a clay tint with a clay dot,
`<= 0` renders `full_waitlist` on linen. Never recompute it from `capacity` in the component.

### 3.3 Empty states (`EmptyState.tsx`)

One component for every empty and terminal surface: the city landing, an empty tab, 404 and the
error route. Muted mark (linen table, clay chair) + title + optional body + one action. It replaced
the ☕ and ⚠️ emoji, which were doing the work of an illustration at 60px.

### 3.4 Host create wizard (`HostCreatePage.tsx`)

3-step wizard implementing **progressive disclosure** (see [`docs/psy.md`](./psy.md)):

- Step 1 "Where?" — route-selected city, venue search, **Mapbox map picker**.
- Step 2 "When?" — `react-day-picker` plus the wrapped `timepicker-ui` range control.
- Step 3 "What?" — title and description → the `createEvent` mutation.

Map, venue search and date/time controls are lazy-loaded. The wizard has no decorative backdrop; the
pin pulse runs only under `prefers-reduced-motion: no-preference`.

### 3.5 Stepper (`Stepper.tsx`)

32px circles: done = filled roast with a check, current = roast border with a clay ring, upcoming =
sand border with taupe numeral. Labels sit under every step. The visible row is `aria-hidden`; the
accessible structure is an sr-only ordered list with `aria-current="step"` and an `aria-live` status
line. Restyle it freely; do not remove that.

### 3.6 Navbar + Footer

- **Navbar**: sticky, **solid** `bg-base-100` (no blur, no translucency), 56/64px, lockup at
  inline-start, `SessionNav` at inline-end. Signed out = roast "Sign in" button; signed in = 32px
  initials avatar opening a disclosure with Profile and Sign out.
- **Footer**: linen, no top border, lockup + tagline + locale chips in the first column, then
  Communities / Company / Legal. Column headings use `.eyebrow`.

### 3.7 Buttons and the one-CTA rule

`primary` is roast and carries almost everything. **`cta` is clay, and one view gets one** — RSVP on
an event, "Host the first meetup" on an empty city. Everything else is `outline`, `ghost` or `link`.
A loading button shows `loading loading-spinner loading-xs` **beside its label**, never a bare
spinner.

### 3.8 RSVP (`RsvpSection.tsx`, `RsvpCancelDialog.tsx`)

Clay CTA, then help text setting the expectation (SMS confirmation, reminder, cancel any time).
Going state is a success chip carrying **both** an icon and text. Failures render inline with
`role="alert"` and a Retry that re-runs the same mutation — never `alert()`. Cancelling opens a real
`<dialog>` naming the host, so focus trapping and Escape come from the platform.

---

## 4. RTL & responsive

- **Logical CSS properties only** (`ps-` / `pe-` / `ms-` / `me-`) — DaisyUI flips under `dir="rtl"`.
- **Arabic-first** — `<html lang="ar" dir="rtl">` is the default; `en`/`fr` via the footer toggle.
- **Test `dir="rtl"` first.** The date tile, avatars and chevrons flip; the wordmark, the symbol and
  numbers do not. The lockup reorders so the symbol sits at inline-start; the symbol itself is never
  mirrored.
- `.eyebrow` carries the Arabic branch: Latin is 11px/600 uppercase with tracking, Arabic is
  12px/500 with neither, because Arabic has no letter case and Tajawal at 11px with tracking is
  unreadable. It is **not** called `.overline` — Tailwind ships an `overline` text-decoration
  utility that would win in the utilities layer and draw a rule above every label.

---

## 5. Accessibility

- Every status chip carries an icon or dot **and** text.
- `:focus-visible` is a 2px clay ring at offset 2, inherited from the base layer.
- Taupe is for eyebrows ≥ 11px/600, icons and placeholders — **never body text**.
- A count shown as a bare numeral gets an sr-only expansion (`this_week_n`), because "Algiers 3"
  reads as nothing.

---

## 6. Where this lives

- **Tokens/theme** → `libs/ui/src/styles.css` (single source of truth).
- **Logo** → `libs/ui/src/components/Logo.tsx` (`Logo`, `LogoSymbol`, `LogoWordmark`; `tone` scales
  the mark from default to reversed, mono or muted).
- **Shared components** → `apps/ui/src/components/` (PascalCase, file name = component name).
- **Route files** → thin: `createFileRoute` + loader + `<Component />`.
- **Copy** → `libs/i18n/messages/{en,fr,ar}.json`. Never hardcode a user-facing string.
- **Design reference** → [`docs/psy.md`](./psy.md) (progressive disclosure, casual copy).

## 7. Migration status

Complete as of 2026-09-04. `apps/ui` carries **zero** uses of the `text-base-content/NN` opacity
ramp, zero `font-extrabold`/`font-black`, zero physical-direction spacing classes, and one raw hex
— the `theme-color` meta tag. Colours are `base-content` / `neutral` / `taupe` and type comes from
the scale.

The list that used to sit here named eight surfaces. It was wrong: it was built from a grep for the
opacity ramp, so it missed every file that was off-theme through type sizes and weights alone
(`PushPermissionPrompt`, `HostWizardHeader`, `ScheduleSummary`, `PublicProfilePage`). If you need
this list again, grep for all three signals, not one.

Two components were worse than off-theme: `PushPermissionPrompt` and `LiveDashboard` used **no
i18n at all** and rendered hardcoded English to every reader, in an Arabic-first product. Some of
the keys they needed already existed, already translated, and were referenced by nothing.

---

## 8. Prototype conformance — 2026-09-04

Everything before this section was written against `Product Redesign.dc.html`, whose eight frames
cover market, event-card states, event detail and wizard step 1. The interactive
`Prototype Vertical Slice.dc.html` covers more screens and, where the two overlap, is the sharper
reference: it carries real measurements rather than a rendered picture of them.

Read against the prototype's own markup — not against a screenshot — the app had drifted in these
places. All are fixed and verified on staging with Playwright at 1200 and 390, in `en` and `ar`.

| Surface            | Was                                                                                | Design                                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| City tiles         | sand border on the active tiles, LogoSymbol dot on the empty ones, fixed 2/4 grid  | `border-color` = the tile's own background (so no visible border in either state), no dot, `auto-fill` from 160px  |
| Feed grids         | `md:grid-cols-2`                                                                   | `auto-fill` from 320px — three columns at desktop                                                                  |
| Card date block    | `.eyebrow` (uppercase, 0.08em tracking)                                            | `.datechip-line` — same 11px/600, no transform, no tracking                                                        |
| Card + detail time | start only                                                                         | `starts_at–ends_at`, wrapped in `dir="ltr"` so RTL does not reverse it                                             |
| Footer             | paper with a top border                                                            | linen band, no rule, pinned to the bottom of short pages                                                           |
| Search field icon  | a literal 📍, which ignores `text-taupe` and renders in the platform's own colours | a 16px circle, 1.5px border in `currentColor`                                                                      |
| City page          | bare title, single-column stack, back link at the foot of the page                 | back link first, `market · city` keyline, title beside a "Host here" button, five filter chips, the same card grid |
| Detail header      | `market › city` breadcrumb                                                         | "Back to {city}"                                                                                                   |
| Detail capacity    | said three times in three wordings, twice on a free event                          | one chip on the card's heading row, in the feed's words                                                            |
| Detail host        | name as a link, "Hosted by"                                                        | name in bold, `Host · {city}`, Profile button                                                                      |
| Login              | bordered card, full lockup, help text under the title                              | bare centred column, lettered symbol alone, help under the field                                                   |

Two traps worth keeping:

- **`min-h-*` on `html`, `body` or `#app` is silently ignored.** `apps/ui/src/styles.css` sets
  `min-height` on those three outside any cascade layer, and unlayered declarations beat every
  layered one whatever their specificity — Tailwind's utilities layer never gets a say. `html` now
  carries a definite height so the percentage resolves; do not reach for `min-h-screen` there.
- **DaisyUI 5 caps `.input`, `.select` and `.textarea` at `clamp(3rem, 20rem, 100%)`.** A field with
  no width class stops at 320px however wide its container is. `Input` carries `w-full` in its base
  string for that reason; a caller that wants a narrow field passes its own width and `cn`'s
  tailwind-merge lets it win.

### Still not built

- **Static map on event detail.** The panel is an empty linen box. Rendering the design's pinned
  preview means a Mapbox Static Images request per page view on the wizard's existing token — same
  integration, new per-view cost, so AGENTS.md §1.8 says ask first.
- **Sponsored chip** on feed cards and the "Coffee paid by" block on detail. Needs a schema column
  and a scope decision.
- **"All 48 wilayas"** beside the cities heading. Needs a route that lists a market's full city set;
  there isn't one.
- **Toasts with undo** after RSVP and cancel, and **copy-link** on the publish success screen.
- **Location-permission explainer** in the wizard, and the **inline sign-in gate** (`gate_title` /
  `gate_body`) instead of redirecting to `/login` mid-wizard.
- The prototype shows a host's **meetup count** (`Host · 14 meetups · Algiers`); the detail payload
  carries no such count, so the meta line is `Host · {city}`.

Copy is the app's own throughout — the prototype's strings are placeholders and were not carried
over. The exceptions are the six filter/host keys and two detail keys added for UI that did not
exist before; their `en` and `ar` come from the design, and the French is unreviewed like the rest.
