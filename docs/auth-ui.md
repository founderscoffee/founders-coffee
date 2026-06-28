# Auth UI — email-OTP + OAuth

P1-003 — the user-facing auth layer. **Passwordless: email-OTP + OAuth** (FR-A4/D4 — phone-OTP was
superseded; phone/WhatsApp are notification-only). No passwords.

## The flow

1. **Email step**: enter email → the inline Turnstile widget produces a token →
   `authClient.emailOtp.sendVerificationOtp({email, type:'sign-in'}, {headers:{'cf-turnstile-response': token}})`.
   The server's `createAuthHandler` (P1-017) verifies the Turnstile token on the brute-force
   endpoints, then Better Auth emails the 6-digit code (`otpLength:6`, `expiresIn:300s`,
   `allowedAttempts:3`, hashed).
2. **Verify step**: enter the code → `authClient.signIn.emailOtp({email, otp})` → session cookie set
   → `window.location.href = redirect` (the `?redirect=` search param, or `/`). First sign-in
   **auto-creates** the user (no separate signup).
3. **OAuth** (conditional): `authClient.signIn.social({provider, callbackURL})` — buttons only when
   `getPublicAuthConfig().hasSocial` (secrets configured). **Dev: disabled** (no secrets) → email-OTP only.

## Backend (pre-existing)

- **P0-008** Better Auth: `createAuth`/`createAuthHandler`/`createAuthClient`, email-OTP plugin
  (`storeOTP:'hashed'`, D1-backed rate limiting), admin RBAC plugin, account linking by verified email.
- **P1-017** `/api/auth/*` mount (apps/ui `server.ts`), `authMiddleware`/`requirePermission` for
  server-fns. `/login` is the CTA target from the P1-002 city empty state.

## Real OTP email (the P1-003 backend gap)

`createAuth` defaulted to `DevEmailProvider` (console.log only). P1-003 wires the real sender:

- **`apps/ui/src/auth-email.ts`** — adapter: Better Auth's `sendOtp({email,otp,type})` → renders
  `NotificationEmail` (reused, no new template) + sends via `createCloudflareEmailProvider`
  (`libs/email`, the `EMAIL` binding). The two `EmailProvider` interfaces differ, so the bridge lives
  in the app. Logs + throws on send failure.
- **`libs/auth/handler.ts`** — `createAuthHandler(env, deps?)` forwards `{ emailProvider }` to `createAuth`.
- **Dev/prod split** (`server.ts`): localhost keeps `DevEmailProvider` (OTP visible in the Worker
  console for the smoke); prod uses the real binding. Locale: base `ar` (no session/market at signup).

## Turnstile widget (inline, no dependency)

`apps/ui/src/components/turnstile.tsx` loads the CF script once + renders the challenge
imperatively (`window.turnstile.render`). The callback stores the token; the login form sends it as
the `cf-turnstile-response` header. Client-only (`useEffect`) — not in SSR HTML. Dev uses CF's
always-pass test sitekey (`1x00000000000000000000AA`); server `DevTurnstileVerifier` auto-passes.

## Session state in the navbar

`apps/ui/src/lib/auth.ts` — the `better-auth/react` client (provides `useSession`). The navbar
(`__root.tsx`) shows Login ↔ Logout. **`useSession` is gated behind a mount flag** (client-only):
better-auth's `react-store` resolves a second React under `react-dom/server` → "Invalid hook call" in
SSR. So SSR renders the static Login link; the client swaps in the real state on hydration
(acceptable flicker — SSR-correct session via a root-loader server-fn is a later polish).

## Notes / verified
- **Secure cookies on localhost** — `auth.ts` sets `secure: true`; verified the session cookie
  persists on `http://localhost:3000` (browsers/curl treat localhost as secure-context). No
  relaxation needed.
- **Endpoints** — Better Auth emailOTP: `POST /api/auth/email-otp/send-verification-otp` +
  `POST /api/auth/sign-in/email-otp` (the client knows the paths; `createAuthHandler`'s Turnstile
  gating matches by `.endsWith`).
- **Deferred** — dashboard auth (P1-006, shared session via cookie domain); SSR-correct session
  (root-loader); localized OTP email + onboarding (`home_market`/`home_city`, P1-004); OAuth tested
  in prod (needs secrets).
- **Cross-app session** — `apps/ui` + `apps/dashboard` are separate Workers; the session cookie must
  be scoped to the parent domain for the host's session to transfer (deployment model TBD, P0-019).
