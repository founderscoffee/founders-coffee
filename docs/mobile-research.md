# React Native (Expo) — Mobile Research for `apps/mobile`

> Research date: 2026-07-01. Sources: Expo docs, Better Auth issues/docs, Paraglide GitHub,
> expo-server-sdk GitHub, StatCounter, DataReportal, 6Wresearch, TanStack Query docs.

---

## 1. Algeria Mobile Market Reality

| Metric | Value | Source |
|---|---|---|
| Mobile connections | 55.6M (117% of population) | DataReportal 2026 |
| Internet users | 37.8M (79.5% penetration) | DataReportal 2026 |
| Mobile internet subscribers | 20M | StateGlobe 2026 |
| Median mobile download speed | 41.21 Mbps | Ookla via DataReportal |
| Android market share | ~85%+ (Samsung #1, Xiaomi #2) | StatCounter Jan 2026 |
| iOS market share | ~10-12% (Apple #3) | StatCounter Jan 2026 |
| Budget phones (A$100-150) | Samsung Galaxy A-series, Xiaomi Redmi, Oppo, Realme | 6Wresearch |
| Average mobile data/user | 15 GB/month | StateGlobe 2026 |
| Broadband (3G/4G/5G) | 94.5% of connections | GSMA via DataReportal |
| 5G status | Early rollout, limited coverage | 6Wresearch |

**Key implications for `apps/mobile`:**
- **Android-first**: ~85%+ of the market. iOS is a minority — optimize for Android, ensure iOS works but don't over-invest.
- **Budget devices**: Samsung A-series, Xiaomi Redmi, Oppo. RAM: 2-4GB typical. App must be lightweight.
- **4G dominant**: 94.5% broadband connections. Offline-first is less critical than in truly offline markets, but intermittent connectivity is common.
- **15 GB/month average**: Users have decent data plans, but don't ship bloated bundles.
- **SMS is king**: 118% mobile connections. Phone-OTP is the right primary auth method.

---

## 2. Reusable vs. Rewritten — Layer-by-Layer Verdict

### ✅ REUSABLE (shared `libs/*` — consume as-is)

| Layer | Package | Reuse method | Notes |
|---|---|---|---|
| **Domain logic** | `libs/domain` | Import directly | Pure TS, no I/O. Money, status machines, validation, capacity math — all portable. |
| **Core utilities** | `libs/core` | Import directly | Money value object, Result/Error, id factory, feature flags, env config. |
| **DB schema** | `libs/db` | Import types only | Drizzle schema types (`Event`, `User`, etc.) are reusable. The D1 binding itself stays on the Worker. |
| **Auth RBAC** | `libs/auth` | Import types + `checkPermission` | RBAC map and permission types are pure. The server-side `createAuth` stays on the Worker. |
| **i18n messages** | `libs/i18n` | Share locale JSON files | The `messages/{ar,en,fr}.json` files are pure data. Paraglide compilation differs (see §3). |
| **Server-fns** | `libs/server-fns` | **NOT directly usable** | `createServerFn` is TanStack Start–specific. The RN app calls the **deployed Worker API** via `fetch` instead. |

### 🔄 REWRITE (UI layer — native components)

| Web (apps/ui) | React Native equivalent | Notes |
|---|---|---|
| Tailwind CSS + DaisyUI | **NativeWind** (Tailwind for RN) | Same utility-class mental model, different runtime. DaisyUI components must be replaced with native equivalents or custom components. |
| TanStack Router (file-based) | **Expo Router** (file-based) | Same file-based routing concept. Expo Router v6 uses React Navigation under the hood. |
| `react-map-gl` + Mapbox | **`@rnmapbox/maps`** | Official Mapbox RN SDK. Same API surface, different rendering. |
| `vanilla-calendar-pro` | Native date picker | Use `@react-native-community/datetimepicker` or a custom component. |
| Lucide icons | **`lucide-react-native`** | Same icons, RN-compatible. |
| HTML `<div>`, `<span>`, `<input>` | `<View>`, `<Text>`, `<TextInput>` | Standard RN primitives. |
| CSS (`styles.css`) | **StyleSheet** / NativeWind | No CSS files in RN. |

### 🔌 NEW (RN-specific — doesn't exist in web)

| Feature | Package | Notes |
|---|---|---|
| **Push notifications** | `expo-notifications` | Client-side: register for push, handle incoming. Server-side: Expo Push API via fetch (see §4). |
| **Secure storage** | `expo-secure-store` | For auth session tokens (replaces browser cookies). Required by Better Auth Expo plugin. |
| **Deep linking** | Expo Router built-in | `betterauthrn://` scheme for OAuth callback. |
| **Network state** | `expo-network` | For TanStack Query `onlineManager` (refetch on reconnect). |
| **Camera/location** | `expo-camera`, `expo-location` | Host "arrived" feature (Phase 5). |
| **OTA updates** | EAS Update | Push JS bundle updates without store review. |
| **Splash screen** | `expo-splash-screen` | Native splash while app loads. |

---

## 3. Cloudflare-Workers Compatibility Verdicts

### 3.1 TanStack Server Functions (`createServerFn`)

**Verdict: NOT directly usable from RN.**

- `createServerFn` is a TanStack Start construct that compiles to Worker RPC stubs at build time. The RN app runs in a separate JS engine (Hermes/V8), not in the Worker.
- **Instead:** the RN app calls the **deployed Worker API** via standard `fetch` to the existing Hono server endpoints (or TanStack Start's server function HTTP endpoints).
- **Alternative:** Expo Router has its own Server Functions (`"use server"`) that can run on a Cloudflare Worker via `expo-server/adapter/workerd`. But this is a **separate server** — not our existing `libs/server-fns`. The two server function systems are incompatible.
- **Recommended path:** consume the existing Worker API via `fetch`. The hooks layer (`apps/mobile/src/hooks/`) wraps these `fetch` calls with TanStack Query. No need to port `libs/server-fns`.

### 3.2 Better Auth

**Verdict: WORKS with caveats (Expo SDK 55+, Better Auth ≥1.3.10).**

- **Official Expo integration exists**: `@better-auth/expo` plugin + `@better-auth/expo/client` plugin.
- **Server side**: Better Auth runs on the Worker (our existing `createAuthHandler`). The Expo app is a **client** that connects to it.
- **Client side**: `expoClient()` plugin handles:
  - Secure cookie storage via `expo-secure-store`
  - OAuth deep link callbacks (`betterauthrn://` scheme)
  - Session persistence across app restarts
- **Known issues (resolved in ≥1.3.10):**
  - `crypto.subtle` not available in Hermes → fixed in Better Auth ≥1.3.10 (PR #4620). No polyfill needed on newer versions.
  - `phoneNumberClient` plugin had build errors in Expo → fixed in ≥1.3.10-beta.7. The phone number plugin works on the **server side** (Worker); the RN client uses the `expoClient` plugin for session management.
- **Phone-OTP flow**: the server sends the OTP via Twilio Verify (our `SmsProvider`). The RN client calls `authClient.phoneNumber.sendVerificationOtp()` → user enters code → `authClient.phoneNumber.verify()` → session stored in SecureStore.
- **Dependencies**: `expo-secure-store`, `expo-network`, `@better-auth/expo`. All maintained by Better Auth team.

### 3.3 Paraglide (i18n)

**Verdict: COMPATIBLE with workarounds. Not first-class RN support yet.**

- Paraglide is Vite-native and compiler-first. It compiles messages to ESM functions at build time.
- **React Native is not an officially supported framework** (Paraglide supports React, Vue, Svelte, Solid, Astro, TanStack Start, SvelteKit, React Router).
- **Workaround 1 (recommended):** Use `react-i18next` or `i18n-js` in the RN app, sharing the same `messages/*.json` locale files with the web app. The JSON files are the shared contract; the compilation step differs per platform.
- **Workaround 2 (experimental):** A community issue (#551) discusses Paraglide in RN. Requires:
  - Custom `defineCustomClientStrategy` for locale detection (no `localStorage` in RN).
  - Metro config plugin to auto-trigger Paraglide compile on locale file changes.
  - Reactive locale state with a `ParaglideProvider` that re-renders the tree on locale change.
- **Decision:** the web app keeps Paraglide. The RN app uses `react-i18next` (mature, widely used in RN, official Expo docs recommend it). Both consume the same `messages/*.json` files — DRY on the translation content, different compilation per platform.

### 3.4 `expo-server-sdk` (Push Notifications)

**Verdict: NOT directly usable on Cloudflare Workers. Must use raw `fetch`.**

- `expo-server-sdk-node` uses `node-fetch` internally, which conflicts with Cloudflare Workers' global `fetch` (causes `TypeError: Illegal invocation` — GitHub Discussion #26099, Zenn article).
- **Community fork exists**: `HiraiKyo/expo-server-sdk-node` comments out the `httpAgent` and works on Workers. But it's unmaintained.
- **Recommended path**: call the Expo Push API directly via `fetch` from the Worker. The API is simple:
  ```
  POST https://exp.host/--/api/v2/push/send
  Headers: { Authorization: "Bearer <access-token>", Content-Type: "application/json" }
  Body: [{ to: "ExpoPushToken[...]", title, body, data }]
  ```
  No SDK needed. The `expo-server-sdk-node` is just a wrapper around this HTTP API. We can build a thin `ExpoPushProvider` in `libs/server-fns` or `libs/notifications` that uses `fetch` directly.
- **Receipt checking**: same pattern — `POST https://exp.host/--/api/v2/push/getReceipts` with `{ ids: [...] }`.

### 3.5 Expo Router + Cloudflare Workers (Server)

**Verdict: WORKS via `expo-server/adapter/workerd`.**

- Expo SDK 54+ has official `expo-server` with a `workerd` adapter for Cloudflare Workers.
- **However**: this is a **separate deployment target** — it's for Expo Router's own server-side features (React Server Functions, API Routes). It is NOT our existing TanStack Start + Hono setup.
- **For `apps/mobile`**: the mobile app is a **client** that calls our existing Worker API. We do NOT need to deploy a second Worker via Expo's adapter. The Expo Router routes are client-side only (Expo Router handles navigation, not server rendering).
- **If we ever want Expo Router server features** (React Server Components, etc.), we'd need to evaluate whether to migrate the existing Worker to Expo's server model or keep them separate. For now, keep them separate.

---

## 4. Architecture Recommendation

```
apps/mobile/
  src/
    app/                    # Expo Router file-based routes
      (tabs)/               # Bottom tab navigator
        index.tsx           # Home / event feed
        explore.tsx         # City search
        profile.tsx         # User profile
      event/
        [id].tsx            # Event detail
      auth/
        login.tsx           # Phone-OTP login
        onboarding.tsx      # First-time setup
    components/             # RN-specific components (View, Text, etc.)
    hooks/                  # TanStack Query hooks wrapping fetch to Worker API
      use-events.ts
      use-markets.ts
      use-profile.ts
      use-auth.ts
    lib/
      api.ts                # fetch wrapper pointing to deployed Worker URL
      auth-client.ts        # Better Auth client with expoClient plugin
      query-client.ts       # TanStack Query client singleton
    locales/                # Shared messages/*.json (imported from libs/i18n or symlinked)
```

**Data flow (mirrors web's §4 contract):**
```
Component → hook (TanStack Query) → api.ts → fetch → deployed Worker API → libs/server-fns → libs/domain → libs/db → D1
```

The only difference: `api.ts` calls `fetch` instead of importing `libs/server-fns` directly. The Worker API is the same; the transport is HTTP instead of in-process RPC.

---

## 5. Risk Summary

| Risk | Severity | Mitigation |
|---|---|---|
| Budget Android devices (2-4GB RAM) | High | Keep bundle size small; lazy-load non-critical screens; test on low-end devices |
| Better Auth crypto.subtle in Hermes | Medium | Use Better Auth ≥1.3.10 (fixed). No polyfill needed. |
| Paraglide not RN-native | Medium | Use `react-i18next` in RN, share `messages/*.json` with web |
| `expo-server-sdk` broken on Workers | Low | Use raw `fetch` to Expo Push API — no SDK needed |
| Expo Server Functions conflict with TanStack Start | Low | Don't use Expo Server Functions — RN is a client calling existing Worker API |
| iOS minority (~10-12% in DZ) | Low | Optimize for Android; ensure iOS works but don't over-invest |
| App Review 4.2 (Apple) | Medium | Ensure genuine app-like value; EAS Update for OTA; PWA Builder as fallback |
| Offline/intermittent connectivity | Low-Med | TanStack Query `onlineManager` + `expo-network`; cache-first for read-heavy screens |

---

## 6. Dependencies to Install (RN app)

```
expo@~54
expo-router@~6
expo-notifications
expo-secure-store
expo-network
expo-crypto              # only if Better Auth <1.3.10
@better-auth/expo
@tanstack/react-query
@rnmapbox/maps
react-i18next            # or i18n-js
i18next
expo-localization
lucide-react-native
```

**NOT installed:** `expo-server-sdk-node` (use raw `fetch`), `@inlang/paraglide-js` (use `react-i18next`), TanStack Form/Virtual/Store (defer to when needed in RN).
