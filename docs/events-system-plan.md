# Events System — consolidated plan (member experience: web + mobile)

> The full member event loop + the new design + SMS-first auth + notifications + real-time + a
> React Native mobile app. This plan covers the **member** experience (`apps/ui` web → `apps/mobile`
> RN). Sponsor + admin apps are separate, web-only, out of scope here.
>
> Reflects the deep-research findings (Twilio/Cloudflare, 2026) and the locked decisions below.
> The RN/Expo architecture details (Phase 8) are pending the running mobile-tooling research.
>
> **SRS alignment:** FR-A4 amended to phone-OTP primary (SRS §5.6). D4/D5 updated (SRS §13).

## App split (locked)
| App | Audience | Surface | In this plan? |
|---|---|---|---|
| **`apps/ui`** | **Members** (incl. hosts — a host is a member who creates events) | Web + the mobile target | ✅ core |
| **`apps/mobile`** (NEW) | Members | **React Native (Expo)** — member-only | ✅ Phase 8 |
| `apps/dashboard` | Sponsors | Web-only (desktop analytics) | ❌ separate (FR-S4) |
| `apps/admin` | Internal team | Web-only | ❌ separate |

**Implications this locks:**
- The **Live Dashboard + host event-management live in `apps/ui`/`apps/mobile`**, NOT `apps/dashboard`. → **P1-016 ("apps/dashboard host view") is re-scoped**: host tools stay in the member app; dashboard becomes sponsor-only.
- **Mobile effort is `apps/ui` only** — one app to build in RN.

## Decisions locked
- **Auth:** phone-primary SMS OTP (Twilio Verify); email retained for OAuth + billing. _(Amends prior D4 — SRS FR-A4/D4 updated.)_
- **Hero:** city-search hero on `/{market}`; `/` stays the geo-redirect.
- **Mobile:** React Native (Expo), member-only, reusing shared `libs/*` logic.
- **Sender ID:** ✅ **already registered** in the Twilio account (was the critical-path blocker — done).
- **Push notifications:** PWA web push via FCM HTTP v1 API (direct); RN native push via EdgePush (self-hosted on CF Workers). One Firebase project covers both web push and native Android. Expo Push API is the fallback if EdgePush doesn't work out.
- **Push timing:** Web push in Phase 6 (Real-time Dashboard); native push in Phase 8 (Mobile RN).

## What this supersedes
| Prior | Change |
|---|---|
| P1-003 email OTP | → SMS OTP (Twilio Verify) |
| P1-009 email notifications | → SMS (T-72h + T-24h); email only for billing |
| P0-016 `libs/email`-only | Email provider stays for billing; SMS provider added (single shared interface) |
| FR-A4/D4 + schema "no phone" | → amend to phone-OTP (SRS updated) |
| `EventSchedulerDO` (old Phase 4) | → **Cron + due-rows** (Free-tier, simpler) |
| Inbound "reply NO" SMS flow | → **KILLED** (Algeria has no two-way SMS via Twilio) |
| Live Dashboard in `apps/dashboard` | → **`apps/ui`/`apps/mobile`** (member experience) |
| Expo Push API for native push | → **EdgePush** (self-hosted on CF Workers, native tokens, no Expo lock-in) |
| Web push demoted | → **FCM HTTP v1 API** direct (web push via FCM, one Firebase project covers both web and native Android) |

## Verified findings that shape the plan (deep-research, 2026)
| Finding | Impact |
|---|---|
| **Algeria: no two-way SMS** (Twilio "Two-way SMS: No"; no +213 numbers) | "Reply NO to cancel" is impossible → cancellation via **in-app / push / web link** |
| **Sender ID mandatory** (LOA Mobilis/Djezzy/Ooredoo; numeric fails on Mobilis) | ✅ registered (done) — unlocks all SMS |
| **Twilio Verify worth it**: stateless + Fraud Guard on-by-default | Use Verify (not roll-your-own); ~$0.31/verification (DZ) |
| **Fraud Guard launch gotcha**: new +213 account's first OTPs blocked (error 60410) | Configure **Safe List / Geo Permissions** before launch |
| **Programmable SMS DZ = $0.2575/segment** | Budget ~$0.26/notification |
| **DOs on Free since Apr 2025** (SQLite-backed, 100k req / 13k GB-s / day caps) | Live Dashboard likely fits Free; Paid only if caps bust |
| **Multi-touch reminders beat single** (RCT, 54k patients: 4.4% vs 5.8% no-show) | Send **T-72h + T-24h**, not just T-24h |
| **iOS Web Push needs 16.4+ + installed PWA** (low reach in DZ) | Web push demoted for iOS; **native push (FCM/APNs via EdgePush) is the real channel** → Phase 8 |
| **FCM HTTP v1 API works from CF Workers** (`fcm-cloudflare-workers` lib, zero deps) | PWA web push via FCM direct — no Expo dependency for web |
| **EdgePush self-hosted on CF Workers** (same stack: Workers + D1 + Queues + DO) | Native push without Expo lock-in; delivery receipts, DLQ, rate limiting built-in |
| **Expo `getDevicePushTokenAsync()`** returns native tokens (not Expo proprietary) | EdgePush migration: one function name change from Expo Push |
| **Firebase project covers both web push and native Android** | One project, one service account, one credential set for FCM web + native |

---

# Phase 0 — Prerequisites (mostly done)
- ✅ **Sender ID registered** (Mobilis/Djezzy/Ooredoo LOA).
- ✅ **Twilio Verify Service** provisioned (`VA…` SID in `.dev.vars.example`).
- 🔲 **Fraud Guard launch mitigation**: before first +213 OTP traffic, configure **Safe List / Geo Permissions** so legitimate Algerian numbers aren't blocked (error 60410). *(Twilio console.)*
- 🔲 Rename `.dev.vars.example` `TWILLIO_*` → `TWILIO_*`; add to `docs/secrets.md` + each app's `.dev.vars`.
- 🔲 Confirm Workers plan: **Free is fine** until DO daily caps bust (Phase 5). No $5/mo needed for Phases 1–4.

# Phase 1 — Foundations
**1A. Data-flow refactor** (AGENTS.md §4 compliance + cross-platform seam for Phase 8):
- **Install TanStack Query:** `npm install @tanstack/react-query`. Wire `<QueryClientProvider>` into `start.ts` or `__root.tsx`.
- **Create features directory structure** (`apps/ui/src/features/{events,markets,profile,auth,geo}/`):
  - `api.ts` — ONLY file that imports `libs/server-fns` (re-exports server-fn calls).
  - `hooks.ts` — TanStack Query hooks (`useQuery`, `useMutation`, `useInfiniteQuery`).
  - `components/` — domain components.
  - `types.ts` — local view types.
- **App-level context providers** — create `apps/ui/src/lib/providers.tsx` with all global providers wired in this order:
  1. `<QueryClientProvider>` (TanStack Query)
  2. `<SessionProvider>` (Better Auth session — `authClient.useSession()`)
  3. `<AuthProvider>` (custom — exposes `user`, `session`, `permissions`, `isAuthenticated` to all components)
  - Wire into `apps/ui/src/routes/__root.tsx` as a single `<AppProviders>` wrapper.
- **Fix 5 AGENTS §4 violations** — components currently importing `@founders-coffee/server-fns` directly (10 route files also import server-fns — fixed by Phase 1A hooks layer; 3 type-only imports in EventCard/EventDetail/RsvpSection are NOT violations):

| Component | Current (violation) | Refactored |
|-----------|---------------------|------------|
| `CityLanding.tsx` | `import { getUpcomingEvents } from '@founders-coffee/server-fns'` | `import { useUpcomingEvents } from '../features/events/hooks'` |
| `MarketLanding.tsx` | `import { getUpcomingEvents } from '@founders-coffee/server-fns'` | `import { useUpcomingEvents } from '../features/events/hooks'` |
| `HostCreatePage.tsx` | `import { createEvent } from '@founders-coffee/server-fns'` | `import { useCreateEvent } from '../features/events/hooks'` |
| `OnboardingPage.tsx` | `import { setHomeLocation } from '@founders-coffee/server-fns'` | `import { useUpdateProfile } from '../features/profile/hooks'` |
| `ProfilePage.tsx` | `import { setHomeLocation } from '@founders-coffee/server-fns'` | `import { useUpdateProfile } from '../features/profile/hooks'` |

- **Data flow enforced:** `Component → hook (TanStack Query) → api.ts → libs/server-fns → libs/domain → libs/db → D1`.

**1B. SMS OTP auth (Twilio Verify):**
- Migration `0005`: `user.phoneNumber` + `user.phoneNumberVerified` (verification table reused).
- **Single SMS provider interface** (`libs/auth/src/providers/sms.ts`): `SmsProvider` + `DevSmsProvider` + `TwilioVerifySmsProvider` (Verify `VA…`). This interface is **shared** between auth OTP and notification SMS (DRY — no parallel provider interfaces). The `DevSmsProvider` captures sent messages in a `sent[]` array for test assertions (same pattern as `DevEmailProvider`).
- **Fraud Guard handling:** Fraud Guard block (Twilio error 60410) maps to `AppError('fraud_guard_blocked')`. NOTE: 60410 is a **temporary 12-hour block** per Twilio docs — retry is technically valid. But for UX, surface immediately: "This number is temporarily blocked. Try email instead." Do NOT spin on retries — the block will auto-lift after 12 hours if no further fraud is detected.
- Add the better-auth **`phoneNumber` plugin** alongside `emailOTP`.
- Login UI → phone-first; email secondary. Turnstile-gate the phone endpoints. Email OTP + OAuth unchanged.
- **Fraud Guard pre-check:** verify Safe List / Geo Permissions are configured before any production OTP traffic. Block Phase 1B completion on this.

**OTP Resend UX (Phase 1B — mandatory):**
The resend flow must be designed from the start, not bolted on later. The key principle: surface every state clearly so the user never feels stuck.

**Component: `ResendOtpButton`** (reusable, in `libs/ui` or `features/auth/components/`)

**State machine (frontend):**

```
idle → sending → cooldown (30s) → resend-available → sending → …
                ↓ error              ↓ error
            error state          error state
```

| State | What the user sees | DaisyUI pattern |
|-------|-------------------|-----------------|
| `idle` | "Send code" button, active | `btn btn-primary` |
| `sending` | Button disabled, spinner | `btn btn-disabled` + `span.loading loading-spinner` |
| `cooldown` | "Resend in `:ss`" — countdown timer replaces button text | `span.countdown font-mono` with `--value` decremented via `setInterval`/`useInterval` |
| `resend-available` | "Resend code" button, active, distinct visual state | `btn btn-outline` (not same as `idle` — user must notice the change) |
| `rate-limited` | "Too many requests. Try again in `N` minutes." inline error + timer | Alert + `countdown` for lockout duration |
| `fraud-guard` | "This number is temporarily blocked. [Try email instead](#)" — hide phone section | Inline alert `alert alert-warning` with email link |
| `network-error` | "Failed to send. [Try again](#)" inline error | Inline alert `alert alert-error` with retry button |

**Countdown implementation:**
- Use DaisyUI's `countdown` component: `<span class="countdown font-mono text-lg"><span style={{"--value": seconds}} aria-live="polite" aria-label={seconds}>{seconds}</span></span>`
- Decrement via React `useEffect` + `setInterval` (or `useInterval` hook) every 1s
- When seconds reach 0, clear interval, transition to `resend-available`
- The `aria-live="polite"` ensures screen readers announce countdown changes
- The countdown reset on each successful resend

**Backend rules:**
1. **Cooldown enforcement:** the auth handler tracks `lastOtpSentAt` per phone number (in-memory with D1 fallback). If `< 30s` since last send, reject with `AppError('otp_cooldown')` — frontend shows remaining cooldown from the error's `retryAfter` field. Never trust client-side cooldown alone.
2. **Turnstile on resend:** every resend requires a fresh Turnstile token (same as initial send). The Turnstile widget re-renders after each resend.
3. **Rate-limit coordination:**
   - Better Auth built-in: 10 requests per 60s per IP (already default on the `phoneNumber` plugin — `window: 60, max: 10`).
   - DO token-bucket (identity-scoped): 5 OTP sends per phone number per 10 minutes.
   - Frontend tells the user which limit they hit: "Too many attempts from this number. Try again in X min." vs "Too many requests from this IP."
4. **Fraud Guard short-circuit:** if a 60410 error was returned for this phone number in the last 12 hours, the `SmsProvider` stores a `fraudGuardBlockedAt` timestamp in D1 (or KV for cache). On the next send attempt, skip the Twilio call entirely and return `AppError('fraud_guard_blocked')` immediately — no network roundtrip, no carrier cost.
5. **Previous OTP invalidation:** every resend invalidates the previous OTP (Better Auth handles this automatically — verification uses the most recent code). The frontend should clear the OTP input on resend and show "A new code has been sent."
6. **Send confirmation:** after a successful resend, show a confirmation message: "A new code has been sent to +213 5XX XX XX XX" (masked: show country code + first digit + last 2 digits only).

**Edge cases specific to resend:**
- **User taps resend before SMS arrives** (both OTPs are valid, Better Auth accepts either — fine, no harm)
- **User taps resend from Fraud Guard block** → no network call, immediate `fraud_guard_blocked` surface
- **User closes browser during cooldown** → no persisting state needed; on next visit to the same device, start fresh (phone number re-entry)
- **Rate limit exhausted before code entered** → the OTP is still valid (unless expired). The user can still enter the code; rate limit is on *sending*, not *verification*. This is intentional — don't block the user from entering the code they already have.
- **Progressive cooldown** (optional, Phase 7): after 3 resends in the same session, increase cooldown to 60s. After 5, escalate to Turnstile re-verification.

**I18n keys for OTP flow** (add to `libs/i18n` locale files `ar.json`, `en.json`, `fr.json`):
- `otp.send` → "Send code"
- `otp.sending` → "Sending…"
- `otp.resend_available` → "Resend code"
- `otp.resend_cooldown` → "Resend in {seconds}s"
- `otp.sent_to` → "A new code has been sent to {number}"
- `otp.rate_limited_number` → "Too many attempts from this number. Try again in {minutes} min."
- `otp.rate_limited_ip` → "Too many requests. Try again in {minutes} min."
- `otp.fraud_guard_blocked` → "This number is temporarily blocked. Try email instead."
- `otp.network_error` → "Failed to send. Try again."
- `otp.enter_code` → "Enter the 6-digit code sent to {number}"
- `otp.code_expired` → "This code has expired. Request a new one."
- `otp.attempts_remaining` → "Incorrect code. {count} attempts remaining."
- `otp.too_many_attempts` → "Too many incorrect attempts. Request a new code."

**Shared `Countdown` component (in `libs/ui`):**
Wraps DaisyUI's `countdown` class with `--value` CSS variable and `aria-live="polite"`. Reused by `ResendOtpButton`, future event timers (RSVP seat-hold, event starts-in), and any countdown surface. Pattern:
```tsx
const Countdown = ({ seconds }: { seconds: number }) => (
  <span className="countdown font-mono text-lg">
    <span style={{ "--value": seconds } as React.CSSProperties} aria-live="polite" aria-label={seconds}>
      {seconds}
    </span>
  </span>
)
```

# Phase 2 — Discovery surface
City-search hero on `/{market}`: warm editorial copy, a unified city-search bar (input + CTA rendered as one component), hyper-local social proof ("🔥 N meetups this week in {city}" via `countUpcomingByCity`), and the **dynamic empty-state pivot** (open city + 0 events → "{city} is an open canvas. be the first to host."). The hero search satisfies curiosity *before* introducing any identity gate — the CTA only routes to auth/host-creation once intent is captured.

**Dynamic CTA contract:** the search CTA's behavior branches on the city selection state:
- No city selected or city with events → routes to `/login` (auth gate before browsing/profile)
- City selected but empty (`open` market, 0 events) → routes to `/host/create?city={code}` (creation flow, no auth gate upfront — the host form challenges mid-journey via Better Auth)

This conversion-flow continuity (anonymous discovery → soft auth gate → host creation, all in `apps/ui`) is why host creation lives in the public app rather than `apps/dashboard`.

**i18n keys** (externalized per FR-L1 — zero hardcoded copy; snake_case, Paraglide-generated):
- `hero_tagline` → "شراكات تبدأ بقهوة" (ar) / "Partnerships start over coffee" (en) / "Les partenariats commencent autour d'un café" (fr)
- `hero_subtitle` → "نجمع رواد الأعمال لبناء العلاقات, اكتشاف فرص الشراكة و النمو معًا" (ar) / "We bring entrepreneurs together to build relationships, discover partnership opportunities, and grow together" (en) / "Nous réunissons les entrepreneurs pour tisser des relations, découvrir des opportunités de partenariat et grandir ensemble" (fr)
- `hero_search_placeholder` → "ابحث عن مدينتك..." (ar)
- `hero_search_cta` → "ابحث عن لقاء" (ar)
- `hero_social_proof` → "{count} لقاءات هذا الأسبوع في {city}" (ar)
- `hero_empty_city` → "{city} لوحة مفتوحة." (ar)
- `hero_empty_subtitle` → "لا توجد لقاءات مخططة في {city} هذا الأسبوع. خصّ 60 ثانية لتحجز طاولة مقهى وتأسّس مجتمعك المحلي." (ar)
- `hero_empty_cta` → "استضف أول قهوة في {city}" (ar)
- Locale files: `ar.json`, `en.json`, `fr.json` with fallback chain `fr → ar`, `en → ar` (SRS §8.6).
- Base locale is `ar` (per `libs/i18n/project.inlang/settings.json`); the locale catalog above shows the ar source — en/fr are translated equivalents, kept in sync via `npx nx run i18n:generate-i18n`.

# Phase 3 — Event list + detail (P1-007)
- **Event feed** in `apps/ui`: TanStack Virtual for long lists, cursor-based pagination (reuses `listUpcomingEvents` from P1-005).
- **Event detail page** (`/events/$slug`): full event info, host profile link, RSVP section, capacity bar, going-count.
- **SEO metadata**: Open Graph tags (title, description, event image via P1-022), canonical URLs, JSON-LD structured data.
- **Prerendering**: critical pages (event detail, city landing) prerendered for SEO + social sharing.
- **Filters**: market/city scope, category (`coffee-meetup`, `workshop`, `demo-day`), language, date range.

# Phase 4 — The event loop 🎯 (testable milestone)
- **RSVP + atomic capacity** (P1-008 contract): `event_rsvps` + `events.rsvps` counter (migration `0006`), atomic `db.batch()`, `rsvp:create/read/update` RBAC, `attachAttendance`, real `RsvpSection`.
- **Idempotency:** `event_rsvps` table MUST have `UNIQUE(event_id, user_id)` constraint. RSVP logic catches `UNIQUE` violations and returns `already_rsvpd` (not a generic error). Prevents double-click / retry duplicates.
- **Rate limiting** (AGENTS §11.5, NFR-4):
  - **Durable Object token-bucket** on the RSVP server-fn (identity-scoped, strongly consistent). Max 5 RSVP attempts per user per 10-minute window.
  - **WAF Rate Limiting** at the edge (blunt volume protection).
  - **Turnstile** on the RSVP form submission (bot protection).
  - All three layers are required — DO for identity-scoped precision, WAF for edge volume, Turnstile for bot prevention.
- **Seat-hold micro-vow:** RSVP click → "Securing your chair…" modal → "Can we count on you?" → "Yes, count me in" (the second explicit click). RSVP isn't confirmed until this.
  - **Seat-hold TTL:** 5 minutes. If the user doesn't confirm within 5 minutes, the held seat is released (automatic via **DO alarm** — set at RSVP creation for `now + 5min`; precise to millisecond, unlike Cron which has 1-min granularity). Cron is backstop-only for missed alarms. Other users can claim the seat after TTL.
  - **Edge cases:** (a) User closes modal after step 1 → seat released on TTL expiry; (b) User takes >5 min → seat released, modal auto-closes, toast: "Your seat was released. Tap RSVP to try again." → RSVP button re-enabled; (c) Request fails after "Yes" → error boundary surfaces the failure, user can retry.
- **Verify the loop:** search → create → view → RSVP (seat-hold) → going-count + remaining → cancel (in-app, not SMS).

# Phase 5 — SMS notifications (no inbound)
- **Scheduler = Cron + `scheduled_notifications` due-rows table** (NOT a DO — Free-tier, 1-min granularity is fine for reminders). worker-jobs cron sweeps due rows → sends.
- **T-72h + T-24h sequence** (evidence-based — beats single T-24h).
- **Cancellation = in-app / push / a web link in the SMS** — there is **no inbound SMS** in Algeria (no "reply NO"). The T-24h SMS copy changes to "…tap to manage your seat" with a deep link.

**DRY notification routing:** the `NotificationMessage` type uses a `channel` field (`sms` | `email`) and dispatches to the **single shared SMS/email provider** (Phase 1B). No parallel provider interfaces.

**Failure handling** (production-grade):
- **Retry:** failed SMS sends retry with exponential backoff (3 attempts, matching `worker-jobs` P0-018 `max_retries:3`). A Twilio rejection (invalid number, carrier block, Fraud Guard) is mapped to a `Result` error — the notification row stays `pending` for retry, not silently dropped.
- **Dead-letter queue:** after 3 failed retries, the notification row moves to `failed` status. An admin can inspect failed notifications in `apps/admin` (FR-M4 audit logging).
- **Fallback channel:** if SMS fails permanently (invalid number), fall back to **email** (Cloudflare Email) for the same notification. The `NotificationMessage` schema includes `fallbackChannel: 'email' | null`.
- **Delivery tracking:** use Twilio status callbacks (`/api/twilio/status`) to update `scheduled_notifications.status` to `delivered` / `failed`. Analytics Engine tracks delivery rate, failure rate, and cost per SMS segment.
- **Cost monitoring:** Twilio bills ~$0.26/segment in DZ. Analytics Engine metric `sms.cost` tracks cumulative spend. Alert if daily cost exceeds **$50 per market** (configurable via feature flag). Alert fires to admin + Cloudflare Email.

**Cron sweep scaling:**
- Composite index on `scheduled_notifications (send_at, status)` WHERE `status = 'pending'` — avoids full-table scan.
- Batch size limit: max 100 rows per Cron invocation (D1 query cost ceiling). If >100 rows are due, the next Cron sweep picks up the rest.
- Each row is processed independently. Failed rows are marked `failed` individually. The sweep does not abort on individual failures.
- Monitoring: track sweep latency and rows-per-sweep in Analytics Engine.

---

## Push notification architecture (locked)

Two independent channels, one Firebase project:

| Surface | Provider | Protocol | Token format |
|---|---|---|---|
| **PWA web push** | **FCM HTTP v1 API** (direct from Worker) | VAPID + Push API | FCM web push registration token |
| **RN Android** | **EdgePush** (self-hosted) → FCM | FCM registration token | Native FCM token |
| **RN iOS** | **EdgePush** (self-hosted) → APNs | APNs device token | Native APNs hex token |

**Why this split:**
- **FCM HTTP v1 API** supports both web push (`message.webpush` field) and native Android (`message.token` with FCM registration token) — one Firebase project covers both.
- **EdgePush** handles native iOS + Android with delivery receipts, DLQ, rate limiting, credential health probes. Self-hosted on CF Workers (same stack). Uses native tokens (no Expo lock-in).
- **PWA web push** is separate from native push — browser Push API + VAPID keys + service workers. Not compatible with EdgePush's native token format.

**Server-side dispatch from Cloudflare Worker:**

```
PWA web push  →  Worker  →  fcm-cloudflare-workers lib  →  FCM HTTP v1 API  →  browser
RN Android    →  Worker  →  EdgePush SDK  →  FCM  →  device
RN iOS        →  Worker  →  EdgePush SDK  →  APNs  →  device
```

**FCM web push from Workers:**
- Use `fcm-cloudflare-workers` (Apache-2.0, zero deps, optimized for CF Workers) or sign JWT manually via Workers crypto APIs.
- Requires Firebase service account JSON (stored as CF secret).
- Send to `POST https://fcm.googleapis.com/v1/projects/{projectId}/messages:send` with `message.webpush` payload.
- VAPID keys generated in Firebase console (Settings → Cloud Messaging → Web Push certificates).

**PWA client (web push):**
- Firebase JS SDK v10+ or native Web Push API.
- Service worker at `/firebase-messaging-sw.js` handles background messages.
- `getToken(messaging, { vapidKey })` returns FCM web push token.
- Store in D1 `push_subscriptions` table with `surface: 'pwa'`.
- iOS Safari requires PWA install (16.4+) — low reach in DZ, native push is the real channel.

**RN client (native push):**
- `expo-notifications` with `getDevicePushTokenAsync()` (NOT `getExpoPushTokenAsync()` — the latter returns Expo proprietary tokens).
- Store in D1 `push_subscriptions` table with `surface: 'rn'`.
- EdgePush handles APNs/FCM dispatch, delivery receipts, and dead token cleanup.

**Token lifecycle:**
- Register on app install / login.
- Send to all user tokens (multi-device support).
- On `DeviceNotRegistered` / `InvalidToken` response, delete from D1.
- Invalidate all tokens on logout.

---

# Phase 6 — Real-time Live Dashboard (in `apps/ui`/`apps/mobile`)
- **`EventLiveDO`** (Durable Object + **WebSocket Hibernation**) — one per in-progress event; activates ~30 min before `startsAt`. **Free-tier DO likely covers it** (10–50 clients × 30 min ≈ well under the 100k req / 13k GB-s daily caps); escalate to Paid only if caps bust.
- Host: "I've Arrived" → DO state change → table-pin (Mapbox micro-picker) + visual-cue text + "ordered coffee" status.
- Attendees: live "In the Room (N/M)" roster, "Walking In" / "Running late" pulses, host table map.
- **Web push via FCM HTTP v1 API** (FCM handles both web push and native Android). iOS web push requires PWA install (16.4+), low reach in DZ — native push in Phase 8 is the real channel for iOS.

**WebSocket auth/authz** (security requirement):
- **Authentication:** client sends the Better Auth session token in the WebSocket protocol header or as the first message after connect. The DO verifies the token against D1 sessions on `webSocketMessage` (not just on connect — sessions can expire mid-connection).
- **Verification mechanism:** EventLiveDO receives the `DB` binding. On each `webSocketMessage`, it queries the `session` table via D1 directly (DOs are isolated — cannot import `libs/auth` module singletons). If `session.expiresAt < Date.now()`, the session is expired.
- **Authorization:** only users with a valid RSVP for the event (`event_rsvps` lookup) can view the live roster. The host (event creator) gets elevated permissions (state changes, table-pin).
- **Session expiry:** if the session expires mid-connection, the DO sends a `auth_expired` close frame (code 4001 — private-use per RFC 6455) and the client attempts re-authentication. On `auth_expired`, client waits 1s → retries re-auth. After 3 failed re-auth attempts, show "Session expired, please refresh". If user's RSVP was cancelled, show "You're no longer attending this event".
- **Message validation:** all incoming WebSocket messages are validated against a Zod schema:
  ```ts
  const arrivingMessage = z.object({ type: z.literal('arrived'), tableNumber: z.number().optional() })
  const walkingInMessage = z.object({ type: z.literal('walking_in') })
  const runningLateMessage = z.object({ type: z.literal('running_late'), etaMinutes: z.number().optional() })
  const tablePinMessage = z.object({ type: z.literal('table_pin'), tableNumber: z.number() })
  ```
  Only recognized message types are processed; unknown types receive an error response.
- **Stale state handling:** if a client's connection drops without a clean close, the DO removes the client from the roster after a 60-second heartbeat timeout.

# Phase 7 — Security + Observability + PWA + Search (pre-launch hardening)

**P1-018: Security hardening pass:**
- **Rate limiting via Durable Object + WAF** (not KV) on all create/auth endpoints.
- **CSP headers** with nonces for inline scripts; strict Content-Security-Policy.
- **RBAC checks on every server-fn** — verify `requirePermission` is composed correctly.
- **Input validation audit** — confirm all endpoints use `appValidator(schema)`.
- **Turnstile coverage** — verify all state-changing endpoints are Turnstile-gated.

**P1-019: Observability:**
- **Analytics Engine dashboards**: events created, RSVPs, density per city/market, notification delivery rate.
- **Alerts**: payment-confirmation backlog, error-rate spikes, D1 size growth, SMS cost threshold.
- **Structured logging** on all server paths (already in P0-014, verify coverage).

**P1-020: PWA:**
- **Web manifest** + service worker (`vite-plugin-pwa`): offline shell for critical pages.
- **Prerendered city pages** for SEO + instant load.
- **PWA Builder score** verification (target: 90+ on Lighthouse).
- **Install prompt** — contextual "Add to Home Screen" after RSVP or event creation.

**P1-015: Semantic search:**
- **Vectorize index** over events (embeddings via Workers AI `bge-m3` — multilingual: ar/fr/en, 1024 dims, cosine).
- **Search UI** in `apps/ui`: text input → Vectorize query → ranked results.
- **Index on create/update** — embeddings generated when event is created or modified.
- **Multilingual queries:** search queries are language-agnostic (bge-m3 handles multilingual natively). No language detection needed on the query path.

# Phase 8 — Mobile app (React Native / Expo) — member-only
> ✅ **Research complete (verified, Jul 2026 — 108 agents, 0 errors).** Architecture below reflects the
> verified reuse-vs-rewrite verdicts. Sources: Nx, Expo, TanStack Start, Better Auth, @rnmapbox/maps,
> Cloudflare docs.

- **`apps/mobile`** — Expo **SDK 55 / RN 0.83 / React 19.2** (Router + EAS Build/Update), added via `nx add @nx/expo` + `nx g @nx/expo:app apps/mobile`. libs/* use TS-source-only exports (no build step) → Metro consumes directly.
- ⚠️ **Monorepo hazard (verified, 3-0):** duplicate React/RN versions are unsupported (apps/ui ships react-dom, apps/mobile ships react-native → must be isolated per-app). Mitigate with root `resolutions`/`overrides` + Expo `experiments.autolinkingModuleResolution` (auto-enabled SDK 55+).
- **EAS Build from day one** — `@rnmapbox/maps` requires custom native code → **not Expo Go** (dev-client / EAS Build mandatory). Pin `RNMapboxMapsVersion` explicitly (the "v11 default" claim was refuted 1-2).

**Verified reuse-vs-rewrite matrix:**

| Layer | Verdict |
|---|---|
| `libs/domain` (pure TS) | ✅ Reuse |
| `libs/auth` (Better Auth) | ✅ Reuse — official **`@better-auth/expo`** plugin on the *same* `better-auth/react` client; sessions in `expo-secure-store`; authenticated fetches via the **Bearer plugin** (`set-auth-token` → `Authorization: Bearer`) |
| `@tanstack/react-query` | ✅ Reuse (no adapter). Wire `onlineManager.setEventListener` + `expo-network` for refetch-on-reconnect (not automatic on RN). |
| **`libs/server-fns` (createServerFn)** | ❌ **Does NOT port (3-0)** — TanStack Start defines only Node-server + Browser-client; no RN target (client machinery assumes DOM/localStorage/hydration). **RN calls the deployed Worker's HTTP endpoints directly via `fetch`** (the server-fn RPC URLs are HTTP → RN can hit them directly, or expose dedicated plain routes). |
| `apps/ui/src/hooks` (react-query hooks) | ◐ Partial — hook signatures + react-query wiring reuse; each `queryFn` swaps the server-fn stub → a `fetch` call (per the server-fns row). |
| `libs/i18n` (Paraglide) | ⚠️ **Unverified / probable rewrite** — not in the RN Directory; `expo-doctor` flags it. Plan RN-specific i18n (storage-backed locale) until proven. |
| UI / routing / styling / map | ❌ Rewrite — TanStack Router → Expo Router; Tailwind/DaisyUI → NativeWind; `react-map-gl` → `@rnmapbox/maps`; all components. |
- **Native push:** EdgePush (self-hosted on CF Workers) → **FCM (Android) + APNs (iOS)**. Client uses `getDevicePushTokenAsync()` (native tokens, not Expo proprietary tokens). Subscriptions in D1. ✅ **Fallback verified:** Expo Push API (`https://exp.host/--/api/v2/push/send`) via plain `fetch` — no auth, no SDK, no deps (limits: 600/sec/project, ≤100/req) — so the EdgePush → Expo-Push fallback is dependency-free and Workers-safe.
- **Real-time:** RN's built-in WebSocket → `EventLiveDO` (verified 3-0: DO Hibernation WebSocket = textbook multi-client coordination; RN connects directly; hibernation = zero idle GB-s billing).
- **Background location** ("host arrived"): foreground `expo-location` ✅ verified; continuous background tracking (paid `react-native-background-geolocation`) + store approval = **open** — re-decide when the Live Dashboard spec is finalized.
- **Auth — phone verification via Firebase PNV:** Replace Twilio Verify with **Firebase Phone Number Verification** (carrier-network silent verification, no SMS) for the RN app. The Firebase Auth SDK on Android/iOS communicates directly with the carrier to silently verify the user's phone number. PWA/Web continues using Twilio Verify + email-OTP since carrier APIs are unavailable on web. Benefits for RN users:
  - **Zero SMS cost** ($0.005/verification vs ~$0.31 via Twilio)
  - **No Fraud Guard issues** (carrier-grade verification, no +213 blocking)
  - **Silent UX** — user grants permission once, no OTP code entry
  - **Sim-swap detection** built in (carrier signals if the SIM changed)
  - Requires the native Firebase SDK — only works on Android/iOS, not Web/PWA.
  - Auth flow: RN app → Firebase PNV (silent carrier check) → returns phone hash → server verifies the Firebase token → creates/looks up Better Auth session. The existing Better Auth `phoneNumber` plugin + `phoneNumberVerified` field on the user schema are reused.
- **OTA updates:** EAS Update (push JS bundle without store review).

**Open items (resolve during build):** Paraglide RN-compat (probable i18n rewrite) · continuous background-geo strategy · Algeria Android-vs-iOS market data (the "Android-first" call is inference, not verified data) · explicit RN-vs-Capacitor cost (committed to RN).

**Push token schema** (must be designed before Phase 6 execution):
- D1 table `push_subscriptions`: `id`, `user_id` (FK→user), `token` (native device token), `platform` (`ios` | `android` | `web`), `surface` (`pwa` | `rn`), `market_code`, `created_at`, `updated_at`.
- **SRS §7 alignment:** SRS §7 `PushSubscription` schema MUST be updated to match: add `surface ('pwa' | 'rn')` and change `platform` to `('ios' | 'android' | 'web')` (currently only `ios | android`).
- **Registration:** tokens are registered on app install / login. RN uses `getDevicePushTokenAsync()` (native APNs/FCM tokens). PWA uses Firebase `getToken(messaging, { vapidKey })` (FCM web push tokens).
- **Invalidation:** when a push send returns `DeviceNotRegistered` or `InvalidToken`, delete the token from D1. Tokens are also invalidated on logout.
- **Schema migration:** add as migration `0008` (after RSVP migration `0006` and notification migration `0007`).

---

## Sequencing
```
Phase 0 (prereqs, mostly ✅) → 1 (refactor + SMS OTP) → 2 (hero) → 3 (event list)
   → 4 (loop) 🎯 → 5 (SMS notif) → 6 (real-time) → 7 (security/obs/PWA/search)
   → 8 (mobile RN)
```
**Phase 4 = testable full event loop.** Phases 5–7 harden it; Phase 8 takes it native.

## Risks / open items
| Risk | Status / mitigation |
|---|---|
| Fraud Guard blocks first +213 OTPs (error 60410) | Phase 0: Safe List / Geo Permissions (blocking prerequisite); mitigated for RN users by Firebase PNV (carrier-network verification, no SMS — Phase 8) |
| DO Free daily caps (100k req / 13k GB-s) | Monitor in Phase 6; Paid only if exceeded |
| RN second-UI cost | Mitigated by the shared logic layer (Phase 1A) — that's the cross-platform seam |
| RN reuse verdicts | ✅ Resolved Jul-2026: server-fns ❌ doesn't port (RN → Worker HTTP via `fetch`); Better Auth ✅ via `@better-auth/expo`+Bearer; react-query ✅; `@rnmapbox/maps` ✅ (EAS Build, not Expo Go); Paraglide ⚠️ still unverified (probable i18n rewrite) |
| SMS delivery failure (carrier blocks, invalid numbers) | Phase 5: retry + fallback to email + delivery tracking via Twilio callbacks |
| RSVP abuse (spam, scripted) | Phase 4: DO rate limiter + WAF + Turnstile (three-layer defense) |
| WebSocket session expiry mid-connection | Phase 6: DO verifies session via D1 lookup on each message; `auth_expired` close frame (code 4001) + 3x re-auth with backoff |
| Push token invalidation (app reinstall, device change) | Phase 8: `DeviceNotRegistered` callback → D1 cleanup; logout invalidation |
| PWA web push iOS reach low (requires PWA install, 16.4+) | Native push in Phase 8 is the real channel for iOS; web push is bonus for Android Chrome |
| EdgePush maturity (v1.0/v1.1) | Self-hosted, same CF stack; fallback: Expo Push API (one function name change) |
| Firebase project setup (service account, VAPID keys, Firebase PNV) | Phase 0 prerequisite; one project covers web push, native Android push via FCM, and Firebase PNV for carrier-based phone verification in the RN app |

## Recommended first step
Commit P1-007b, then **Phase 1A (refactor) + Phase 1B (SMS OTP)**. The refactor's logic layer is
also the sharing seam Phase 8 depends on — so it earns double.
