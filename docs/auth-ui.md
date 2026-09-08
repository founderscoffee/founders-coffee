# Authentication UI

Authentication is passwordless and implemented with Better Auth. The backend supports email OTP, phone OTP, and configured OAuth providers; the current `apps/ui` login screen exposes email OTP and conditional OAuth.

Authentication in the [current release](./release-strategy.md) exists to support community members,
hosts, profiles, event creation, and RSVP. Sponsor and commercial-client authentication belongs to
future work and is not a release requirement.

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
- The admin app remains protected by Cloudflare Access and must also verify the Access JWT inside the
  Worker. Its admin-owned Better Auth session stays on the admin origin; every privileged request
  must match the verified Access email to the verified Better Auth email and carry both the Access
  subject and Better Auth user ID into authorization/audit context.

## App ownership

- `apps/ui`: member and host authentication, onboarding, profile, and event participation.
- `apps/dashboard`: future sponsor-only application; it remains outside the community release.
- `apps/admin`: internal operations; Cloudflare Access is present, while the correlated
  Better Auth/RBAC session wiring remains planned under CO-04.

Onboarding for market, state, and city is implemented in `apps/ui`. The geographic values use canonical market/state/city codes and the current versioned TypeScript reference datasets.

## Approved replacement — planned, 2026-09-08

The [Profile and Account Management Plan](./profile-account-implementation-plan.md), PF-01 through
PF-12, replaces this location-based onboarding with display-name completion only. OTP and OAuth
shall return members to their original action without collecting a home location or requiring
optional profile details. The existing inline host sign-in gate must follow the same name-completion
rule while preserving its pending publish and OAuth draft-return behavior. It also adds opt-in public fields, managed photos, verified contact and
session controls, notification preferences, export and deletion. Existing home columns are removed
through a reviewed migration; event geography remains unchanged. The current-flow description above
is an implementation audit, not a requirement to preserve geographic onboarding.
