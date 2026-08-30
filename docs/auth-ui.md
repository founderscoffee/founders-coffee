# Authentication UI

Authentication is passwordless and implemented with Better Auth. The backend supports email OTP, phone OTP, and configured OAuth providers; the current `apps/ui` login screen exposes email OTP and conditional OAuth.

## Current user flow

1. The user enters an email address and completes Turnstile.
2. `apps/ui` requests a Better Auth email verification code.
3. The user submits the code and Better Auth creates the session cookie.
4. A new or incomplete profile is redirected to `/onboarding`; otherwise the requested redirect or home route is used.
5. OAuth buttons appear only for configured providers.

The navigation reads the Better Auth session client-side and switches between login and logout. Server-rendered session-aware navigation remains a possible polish item, not a prerequisite for the existing flow.

## Backend capabilities

- sessions and Better Auth rate-limit records are stored in D1;
- email and phone OTPs are short-lived, attempt-limited, and hashed where Better Auth supports it;
- Turnstile protects OTP-send endpoints;
- the trusted client IP is derived from `CF-Connecting-IP`;
- authorization is centralized through the shared RBAC layer;
- OAuth providers are disabled when their credentials are absent.

Phone OTP via Twilio Verify is a backend capability but is not currently presented by the login screen. Documentation must not call it the active primary UI until that screen exists.

## Email OTP delivery

The UI app adapts the auth-specific OTP interface to the general Cloudflare Email provider. Production uses the `EMAIL` binding and a verified sender. Local development may use a development provider so a developer can complete the login flow.

## Security and release requirements

- Missing Turnstile configuration fails the protected deployed endpoints closed.
- `TURNSTILE_DISABLED=true` and development Turnstile keys are local-only.
- Twilio development logging is local-only. The current missing-credential fallback in the shared auth provider must fail closed before phone OTP is enabled in a deployed UI.
- Production cookie domain, HTTPS, and cross-subdomain behavior must be verified in staging.
- The admin app remains protected by Cloudflare Access and must also verify the Access JWT inside the Worker.

## App ownership

- `apps/ui`: member and host authentication, onboarding, profile, and event participation.
- `apps/dashboard`: sponsor-only application; authenticated sponsor flows are planned as that shell is implemented.
- `apps/admin`: internal operations; Cloudflare Access is present, while full Better Auth/RBAC wiring remains planned.

Onboarding for market, state, and city is implemented in `apps/ui`. The geographic values use canonical market/state/city codes and the current versioned TypeScript reference datasets.
