# AGENTS.md Violations Fix Plan

> **Generated from full codebase audit.** 78+ violations across 7 categories. This plan organizes fixes by priority and dependency order.

---

## Overview

| Category | Count | Severity | Effort |
|----------|-------|----------|--------|
| Route files with inline component logic | 8 | Critical | Large |
| layer:ui → layer:server imports | 9 files | Critical | Medium |
| File structure (misplaced files in src/) | 2 | High | Trivial |
| Component name ≠ file name | 13 | High | Small |
| DRY violations (duplicated code) | 4 | High | Small |
| Hardcoded user-facing strings | 23+ | Medium | Medium |
| Inline comments | 18 | Low | Small |
| Boolean prop naming | 1 | Low | Trivial |

---

## Phase 1: Extract Components from Route Files (Critical)

**Why first:** This is the largest structural violation. Every other fix (DRY extraction, i18n, naming) is easier once components are in proper files.

### 1.1 Extract `HostCreatePage`

| | |
|---|---|
| **Source** | `apps/ui/src/routes/host.create.tsx` (lines 50–242, 190+ lines) |
| **Target** | `apps/ui/src/features/events/components/HostCreatePage.tsx` |
| **State to move** | 12 state variables, 3-step wizard, validation, publish handler |
| **Constants to extract** | `COUNTRIES`, `LANGUAGES`, `CATEGORIES` (shared with onboarding/profile) |
| **Dependencies** | Lazy-loaded `MapPicker`, `DatetimePicker` |
| **Route file after** | ~30 lines: auth guard + `<HostCreatePage />` |

### 1.2 Extract `OnboardingPage`

| | |
|---|---|
| **Source** | `apps/ui/src/routes/onboarding.tsx` (lines 23–188, 165+ lines) |
| **Target** | `apps/ui/src/features/onboarding/components/OnboardingPage.tsx` |
| **State to move** | 6 state variables, cascading selects, city combobox, save handler |
| **Shared code** | `COUNTRIES` (shared with profile, host.create), city search combobox (shared with profile) |
| **Route file after** | ~20 lines: auth guard + `<OnboardingPage />` |

### 1.3 Extract `ProfilePage`

| | |
|---|---|
| **Source** | `apps/ui/src/routes/profile.tsx` (lines 31–165, 135+ lines) |
| **Target** | `apps/ui/src/features/profile/components/ProfilePage.tsx` |
| **State to move** | Edit/save toggle, city search, cascading dropdowns, save handler |
| **Shared code** | `COUNTRIES`, `initials()`, city search combobox |
| **Route file after** | ~20 lines: auth guard + `<ProfilePage />` |

### 1.4 Extract `LoginPage`

| | |
|---|---|
| **Source** | `apps/ui/src/routes/login.tsx` (lines 26–157, 130+ lines) |
| **Target** | `apps/ui/src/features/auth/components/LoginPage.tsx` |
| **State to move** | Multi-step form (email → OTP), validation, OAuth, Turnstile |
| **Route file after** | ~15 lines: loader + `<LoginPage />` |

### 1.5 Extract `MarketLanding`

| | |
|---|---|
| **Source** | `apps/ui/src/routes/$market/index.tsx` (lines 20–101, 80+ lines) |
| **Target** | `apps/ui/src/components/market-landing.tsx` |
| **State to move** | Tab state, dev sample data, hero, cities, discover section |
| **Route file after** | ~15 lines: loader + `<MarketLanding />` |

### 1.6 Extract root layout components

| | |
|---|---|
| **Source** | `apps/ui/src/routes/__root.tsx` (lines 57–183) |
| **Targets** | `apps/ui/src/components/navbar.tsx`, `footer.tsx`, `locale-toggle.tsx`, `session-nav.tsx`, `login-link.tsx` |
| **Route file after** | ~40 lines: `<html>` shell with `<Navbar />`, `<Outlet />`, `<Footer />` |

### 1.7 Extract `PublicProfilePage`

| | |
|---|---|
| **Source** | `apps/ui/src/routes/u.$userId.tsx` (lines 16–61) |
| **Target** | `apps/ui/src/components/public-profile.tsx` |
| **Shared code** | `initials()` |

### 1.8 Extract `CityLanding`

| | |
|---|---|
| **Source** | `apps/ui/src/routes/$market.$city.tsx` (lines 16–47) |
| **Target** | `apps/ui/src/components/city-landing.tsx` |

---

## Phase 2: Fix layer:ui → layer:server Imports (Critical)

**Why second:** After components are extracted, the import paths need to go through the proper `api.ts → hooks.ts` chain.

### 2.1 Create `apps/ui/src/features/` domain folders

For each domain used in routes, create the standard structure:

```
apps/ui/src/features/
  auth/
    api.ts          # re-exports from @founders-coffee/server-fns (auth-related)
    hooks.ts        # TanStack Query hooks
  events/
    api.ts          # re-exports createEvent, getStates, etc.
    hooks.ts        # useCreateEvent, useStates, etc.
  geo/
    api.ts          # re-exports getCities, getStates
    hooks.ts        # useCities, useStates
  profile/
    api.ts          # re-exports getMyProfile, setHomeLocation
    hooks.ts        # useProfile, useUpdateProfile
  markets/
    api.ts          # re-exports getVisibleMarkets, getMarketLanding, etc.
    hooks.ts        # useMarkets, useMarketLanding
```

### 2.2 Update route files to import from `api.ts` / `hooks.ts`

Replace all direct `@founders-coffee/server-fns` imports in route files with imports from the local `features/<domain>/api.ts`.

**Before:**
```ts
import { getMarketLanding } from '@founders-coffee/server-fns'
```

**After:**
```ts
import { getMarketLanding } from '../features/markets/api'
```

### 2.3 Add `layer:ui` tag to `apps/ui/project.json`

Update `apps/ui/project.json` tags so ESLint boundary rules enforce the layer separation:

```json
"tags": ["type:app", "domain:public", "layer:ui"]
```

This makes the `layer:ui` rule (`onlyDependOnLibsWithTags: ['layer:ui', 'layer:shared']`) apply to `apps/ui`, catching future violations at lint time.

### 2.4 Repeat for `apps/dashboard` and `apps/admin`

Same pattern — create `features/*/api.ts` wrappers, add `layer:ui` tag.

---

## Phase 3: Fix Component Naming (High)

**Why third:** Renaming files is a low-risk mechanical change, but should happen after extraction so we only rename once.

### 3.1 Rename kebab-case files to PascalCase in `apps/ui/src/components/`

| Current | Target |
|---------|--------|
| `datetime-picker.tsx` | `DatetimePicker.tsx` |
| `event-card.tsx` | `EventCard.tsx` |
| `hover-3d.tsx` | `Hover3D.tsx` |
| `map-picker.tsx` | `MapPicker.tsx` |
| `turnstile.tsx` | `Turnstile.tsx` |

Update all imports in consuming files after each rename.

### 3.2 Rename kebab-case files to PascalCase in `libs/ui/src/components/`

| Current | Target |
|---------|--------|
| `badge.tsx` | `Badge.tsx` |
| `button.tsx` | `Button.tsx` |
| `card.tsx` | `Card.tsx` |
| `input.tsx` | `Input.tsx` |

Update all imports in consuming files after each rename.

### 3.3 Rename email templates

| Current | Target |
|---------|--------|
| `libs/email/src/templates/base.tsx` | `EmailBase.tsx` |
| `libs/email/src/templates/notification.tsx` | `NotificationEmail.tsx` |

---

## Phase 4: Fix DRY Violations (High)

### 4.1 Extract `COUNTRIES` constant

| | |
|---|---|
| **Duplicated in** | `host.create.tsx`, `onboarding.tsx`, `profile.tsx` |
| **Target** | `libs/core/src/constants.ts` (new file) or `libs/i18n/src/geo.ts` |
| **Export** | `COUNTRIES` array with `{ code, name, flag }` |

### 4.2 Extract `initials()` utility

| | |
|---|---|
| **Duplicated in** | `profile.tsx`, `u.$userId.tsx`, `event-card.tsx` (inconsistent!) |
| **Target** | `libs/ui/src/utils/name.ts` |
| **Behavior** | Standardize: first letter of each word, join, take 2 chars. Fix `event-card.tsx` to match. |

### 4.3 Extract `CitySearchCombobox` component

| | |
|---|---|
| **Duplicated in** | `profile.tsx` (lines 123–149), `onboarding.tsx` (lines 134–173) |
| **Target** | `apps/ui/src/components/city-search-combobox.tsx` (or `libs/ui` if reusable across apps) |
| **Props** | `{ countries, states, onSelect, placeholder }` |

### 4.4 Unify dashboard/admin root shells

| | |
|---|---|
| **Duplicated in** | `apps/dashboard/src/routes/__root.tsx`, `apps/admin/src/routes/__root.tsx` |
| **Target** | Shared `RootShell` component in each app's `components/` (or `libs/ui` if identical) |

---

## Phase 5: Fix Hardcoded Strings (Medium)

### 5.1 Create i18n keys for brand/meta strings

Add to `libs/i18n/locales/`:

| Key | Value (en) | Value (ar) |
|-----|-----------|-----------|
| `brand.name` | `founders.coffee` | `founders.coffee` |
| `brand.tagline` | `local founder communities` | `مجتمعات المؤسسين المحلية` |
| `meta.login_title` | `Sign in — founders.coffee` | `تسجيل الدخول — founders.coffee` |
| `meta.profile_title` | `Profile — founders.coffee` | `الملف الشخصي — founders.coffee` |

### 5.2 Create i18n keys for form placeholders

| Key | Value (en) | Value (ar) |
|-----|-----------|-----------|
| `host.placeholder.search_cafe` | `Search for a café…` | `ابحث عن مقهى…` |
| `host.placeholder.title` | `Coffee + code, or just coffee?` | `قهوة وبرمجة، أم قهوة فقط؟` |
| `host.placeholder.description` | `What's the plan?` | `ما الخطة؟` |

### 5.3 Create i18n keys for role labels

Replace the broken `ROLE_LABELS` indirection in `profile.tsx` with direct i18n calls.

### 5.4 Create i18n keys for email subjects

| Key | Value |
|-----|-------|
| `email.subject.signIn` | `founders.coffee — your sign-in code` |
| `email.subject.verify` | `founders.coffee — your verification code` |

### 5.5 Create i18n keys for category/language labels

| Key | Value (en) | Value (ar) |
|-----|-----------|-----------|
| `category.coffee-meetup` | `Coffee Meetup` | `لقاء قهوة` |
| `category.workshop` | `Workshop` | `ورشة` |
| `category.demo-day` | `Demo Day` | `يوم العروض` |
| `language.ar` | `Arabic` | `العربية` |
| `language.en` | `English` | `English` |
| `language.fr` | `French` | `Français` |

---

## Phase 6: Clean Up Inline Comments (Low)

### 6.1 Remove JSX section comments

15 JSX comments like `{/* Hero */}`, `{/* Step 1: Where */}`, `{/* Card body */}` — remove all. Code structure is self-documenting.

**Files:** `event-card.tsx`, `$market/index.tsx`, `login.tsx`, `host.create.tsx`, `onboarding.tsx`, `u.$userId.tsx`

### 6.2 Remove or convert block comments

3 block comments like `/* P1-007 adds real counts */` — remove or convert to JSDoc if needed for API docs.

**Files:** `$market/index.tsx`, `$market.$city.tsx`

### 6.3 Enforce 100-char comment line limit

All comments (JSDoc, block, inline exempted `eslint-disable`/`@ts-*`) must not exceed 100 characters per line. If a JSDoc comment needs more, split across multiple lines.

**Before:**
```ts
/**
 * Adapter: Better Auth's email-OTP plugin calls `sendOtp({email, otp, type})`; this renders a NotificationEmail with the code + sends it via the real Cloudflare Email binding.
 */
```

**After:**
```ts
/**
 * Adapter: Better Auth's email-OTP plugin calls `sendOtp({email, otp,
 * type})`. This renders a NotificationEmail with the code and sends
 * it via the real Cloudflare Email binding.
 */
```

---

## Phase 7: Fix File Structure — Move Misplaced Files to `lib/` (High)

**Why here:** After components are extracted and before DRY cleanup. Ensures the `lib/` directory is properly populated with app infrastructure before we start extracting shared utilities.

### 7.1 Move `auth-email.ts` → `lib/auth-email.ts`

| | |
|---|---|
| **Source** | `apps/ui/src/auth-email.ts` |
| **Target** | `apps/ui/src/lib/auth-email.ts` |
| **Reason** | App-level infrastructure (adapter bridging Better Auth OTP to Cloudflare Email). Not a component, not a route. Belongs in `lib/` per AGENTS.md §3. |
| **Update** | Import path in whichever file calls `createOtpEmailProvider` |

### 7.2 Move `router.tsx` → `lib/router.tsx`

| | |
|---|---|
| **Source** | `apps/ui/src/router.tsx` |
| **Target** | `apps/ui/src/lib/router.tsx` |
| **Reason** | App bootstrap code (TanStack Router configuration). Per AGENTS.md §3: `lib/ # app bootstrap (query client, router context, providers)`. |
| **Update** | Import path in `start.ts` or `server.ts` (wherever the router is initialized) |

### Resulting `apps/ui/src/` structure

```
apps/ui/src/
  routes/              # thin route files (after Phase 1 extraction)
  features/            # domain folders (after Phase 2 creation)
  components/          # app-level shared components
  lib/                 # app bootstrap + infrastructure
    auth.ts            # existing
    auth-email.ts      # moved from src/
    router.tsx         # moved from src/
    sample-events.ts   # existing (dev-only)
  server.ts            # Workers entry (stays in root)
  start.ts             # TanStack Start entry (stays in root)
  styles.css           # global styles (stays in root)
  routeTree.gen.ts     # codegen (stays in root)
```

---

## Phase 8: Fix Boolean Prop Naming (Trivial)

### 7.1 Rename `fullWidth` → `isFullWidth`

| | |
|---|---|
| **File** | `libs/ui/src/components/button.tsx` (line 21) |
| **Prop** | `fullWidth` → `isFullWidth` |
| **Update** | 5 usage sites in `login.tsx` and `host.create.tsx` |

---

## Execution Order

```
Phase 1 (Extract components)  ← do first, everything depends on this
  ↓
Phase 2 (Fix imports)  ← do second, after components are in proper files
  ↓
Phase 3 (Rename files)  ← do third, after extraction so we rename once
  ↓
Phase 4 (DRY extraction)  ← do fourth, shared code is cleaner after extraction
  ↓
Phase 5 (i18n strings)  ← do fifth, strings are easier to find in extracted components
  ↓
Phase 6 (Remove comments)  ← do sixth, mechanical cleanup
  ↓
Phase 7 (Move files to lib/)  ← do seventh, restructure app infrastructure
  ↓
Phase 8 (Boolean prop)  ← do last, trivial
```

---

## Verification

After each phase, run:

```bash
npx nx run-many -t typecheck lint test build
```

After Phase 2, additionally verify boundary rules catch violations:

```bash
npx nx run-many -t lint
```

---

## Estimated Effort

| Phase | Effort | Files touched |
|-------|--------|---------------|
| Phase 1: Extract components | ~3 hours | 8 route files + 8 new component files |
| Phase 2: Fix imports | ~2 hours | 9 route files + 6 new api.ts files + 3 project.json |
| Phase 3: Rename files | ~30 min | 12 files renamed + import updates |
| Phase 4: DRY extraction | ~1 hour | 6 files modified + 2 new shared files |
| Phase 5: i18n strings | ~1.5 hours | 9 files + 2 locale files |
| Phase 6: Remove comments | ~15 min | 6 files |
| Phase 7: Move files to lib/ | ~5 min | 2 files moved + 2 import updates |
| Phase 8: Boolean prop | ~5 min | 1 file + 5 usage sites |
| **Total** | **~8.5 hours** | |
