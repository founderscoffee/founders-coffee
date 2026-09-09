# Profile and Account Management Implementation Plan

| Field          | Value                                                                                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status         | PF-01/PF-02 complete locally and audited; PF-03a in progress on the working tree; PF-03b onward planned; no remote migration or deployment                              |
| Decision date  | 2026-09-08                                                                                                                                                              |
| Last reviewed  | 2026-09-09 — plan reviewed against the tree; findings folded in below                                                                                                   |
| Owner          | Founder / Product                                                                                                                                                       |
| Scope          | Location-free onboarding, editable profiles, privacy, photos, notifications, account security, export and deletion                                                      |
| Parent tickets | P1-003, P1-004, P1-009, P1-013, P1-018, P1-021                                                                                                                          |
| Requirements   | FR-A1 through FR-A11, FR-G2, FR-E7, FR-E8, FR-E12, FR-L1 through FR-L6, FR-M2; NFR-4, NFR-5, NFR-7 through NFR-12                                                       |
| Related plans  | [Event creation](./event-creation-remediation-plan.md), [community operations](./community-operations-implementation-plan.md), [main roadmap](./implementation-plan.md) |

## 1. Approved product decisions

The member profile supports introductions, trust and repeat participation in the community release.
It is not a professional directory, recruiting product or social network.

- Remove home city, state and market from the profile, required onboarding, public responses and active account storage. Never replace them with an inferred residence.
- Keep event market/state/city and city discovery. A browsing location is a device preference, not a statement about where the member lives.
- Public profiles are minimal. Optional details are private until the member explicitly opts to publish them. Saving a detail and publishing it are separate choices.
- Include full profile and account management: verified email/phone changes, connected login methods, active sessions, notification preferences, data export and account deletion.
- Include custom photo upload, replacement and removal using R2 and Cloudflare Images. The user approved planning these services subject to checking cost and availability; provisioning or purchasing is not part of this documentation task.
- Keep authentication passwordless, interface locales `ar`, `fr`, `en`, PWA push primary and SMS fallback. Do not add phone-login UI merely because verified contact management needs phone OTP.
- Collect only a display name beyond authentication. Never force optional profile enrichment before RSVP or event creation, and never discard the event draft during authentication or reauthentication.

## 2. Repository audit and patterns to follow

This is a source/configuration audit on 2026-09-08, not a live infrastructure, CI or browser certification.
**The "Observed reality" column records the tree on that date and is deliberately not updated as tickets
land.** PF-03a has already changed several rows — `setHomeLocation` is now a `client_refresh_required`
tombstone rather than an inline-SQL writer, and the residence columns are gone from the Drizzle schema.
Read this table as the starting condition the tickets were written against, never as current state.
The worktree was clean at the start. The code-review-graph tools were unavailable and the documented
parent `/Users/workstation/CLAUDE.md` did not exist; source inspection used `rg` and direct file reads.

| Area and evidence                                                                    | Observed reality                                                                                                                             | Required treatment                                                                                                            |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `apps/ui/src/components/profile/ProfilePage.tsx`                                     | Edit mode changes location only; mutation errors can leave saving state stuck; user identity is not editable                                 | Replace with feature-owned sections, shared validation, explicit success/error/pending states                                 |
| `apps/ui/src/components/profile/OnboardingPage.tsx`; `components/auth/LoginPage.tsx` | Country/state/city collection; login uses `homeMarketCode` as a completion signal                                                            | Remove geographic completion checks for both OTP and OAuth; retain safe return paths                                          |
| `components/host/HostSignInGate.tsx`; `features/events/useHostCreateWizard.ts`       | Host OTP runs inline and continues an already requested publish; OAuth returns to the wizard; this path bypasses geographic onboarding       | Cover both inline and standalone auth; preserve submission intent and avoid duplicate creation or an unwanted redirect        |
| `apps/ui/src/routes/profile.tsx`, `onboarding.tsx`, `u.$userId.tsx`                  | Routes load geography and import server functions directly; public route fetches at most 20 upcoming events                                  | Thin routes wired through feature APIs/query options; remove profile geography and use real paginated hosted history          |
| `libs/server-fns/src/profile.ts`                                                     | `setHomeLocation` has permission and DO limiting but raw Zod validator, inline SQL and no Turnstile; private DTO spreads the full user row   | Explicit public/owner response schemas, repository functions, `appValidator`, ownership, shared protection and telemetry      |
| `apps/ui/src/features/profile/api.ts`, `hooks.ts`                                    | Correct API/hook seam exists, but input types are handwritten and mutation does not invalidate profile queries                               | Reuse this feature boundary; infer types and centralize query keys/invalidation                                               |
| `libs/db/src/schema.ts`                                                              | User stores identity, contact, role, locale and home fields; no biography, visibility or preference model                                    | Add validated profile/preferences schema and migration; retire home columns without editing historical migrations             |
| `libs/auth/src/auth.ts`, `captcha.ts`, `handler.ts`, `rbac.ts`                       | Better Auth with D1, email/phone OTP, configured Google/GitHub, strict linking and partial captcha endpoint coverage                         | Extend existing auth integration and RBAC; prevent direct Better Auth endpoints bypassing new policies                        |
| Installed Better Auth source                                                         | Session listing/revocation, unlinking, email-OTP change and verified phone-update APIs exist; presence alone does not mean configured safely | Verify installed contracts in PF-07; do not implement another OTP/session system                                              |
| `libs/infra/src/images/provider.ts`; `apps/ui/wrangler.jsonc`                        | ImageProvider and raw R2 reader exist; public app has no R2/Images binding or upload flow                                                    | Implement production upload/transform path and all environment bindings; do not treat interface presence as a working feature |
| `features/push/client.ts`, `libs/server-fns/src/push/rpc.ts`                         | Existing Firebase web push; errors are swallowed; registration/removal exist, preference UI and complete mutation protection do not          | Reuse FCM provider; return truthful browser/provider states and connect settings to actual delivery                           |
| `libs/db/src/schema.ts` foreign keys                                                 | User deletion cascades to events, RSVPs, scheduled notifications and push subscriptions                                                      | Never expose the raw delete-user operation before retention, cancellation and counter safety are implemented                  |
| `components/shell/SessionNav.tsx`; `features/events/created-event-cache.ts`          | Direct sign-out; an event-created cache invalidation pattern already exists                                                                  | Reuse hook/API flow; update session-derived identity and profile/event caches after edits; clear private state on sign-out    |
| `docs/srs.md`, community plan, localized privacy content                             | NFR-5 already defines export/deletion and retention; current privacy page advertises home location and email-based requests                  | Update product requirements now; update runtime/privacy copy when the behavior ships; preserve existing retention rules       |

### Actual toolchain

- npm workspaces, Nx 23.1.1, strict TypeScript 6, React 19, TanStack Start/Router and Query; Cloudflare Workers through Vite/Wrangler.
- Shared Zod 4 contracts in `libs/domain`, Drizzle/D1 in `libs/db`, Better Auth in `libs/auth`, Paraglide locale messages in `libs/i18n`, Tailwind v4/DaisyUI and shared `libs/ui` primitives.
- Reuse local form state backed by shared schemas, as the event wizard does. TanStack Form is not declared in the inspected manifests; do not add it silently. Declare any new direct dependency explicitly rather than relying on transitive installation.
- Reusable non-server UI state follows the established TanStack Store rule; transient form state may remain local. No new form, upload, auth, cropper or state package is required by this plan.
- Current CI runs Prettier, `nx sync:check`, typecheck, lint including Nx boundaries, tests and builds. Vitest uses real Miniflare bindings; Playwright remains local/staging and outside CI.
- Keep arrow functions, inferred types, component/file naming, comment policy and the 300-line source-file limit. Shared test setup ends in `.fixtures.ts`.

The current event-create RPC intentionally has no Turnstile challenge, while AGENTS.md still requires
it for state-changing endpoints. This is an existing policy/code mismatch. It is not permission to
omit protection from new profile mutations, and this plan does not reopen event creation. PF-01
records the applicable decision and avoids copying an exception to unrelated endpoints.

## 3. Profile contract and page behavior

The [Profile UI/UX Design Specification](./profile-ui-design-spec.md) and its
[interactive prototype](./design/profile/index.html) define the premium Round Table visual direction,
responsive composition, privacy affordances and state treatments. Created on 2026-09-08 after a
review of current Apple/Google design guidance, they use the existing theme and add no production
dependency. PF-04 through PF-11 implement the design through the architecture below; the prototype
is an isolated study with sample data, not shipped profile/account functionality.

The limits below are frozen PF-01 contracts, implemented once in PF-02 shared Zod schemas.
Optional fields are nullable/clearable; empty values are normalized consistently. User-authored
text is plain text, bounded, rendered as authored and never automatically translated.

| Field                  | Contract                                                                                        | Public behavior                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Display name           | Required, trimmed, 1–80 Unicode code points; no legal-name or company requirement               | Always public; never fall back to email or phone in public UI                                            |
| Photo                  | Optional JPEG/PNG/WebP upload; maximum 5 MiB and 16 megapixels; server validates and normalizes | Private until photo publication is enabled; initials otherwise                                           |
| Introduction           | Optional, maximum 300 characters; authored locale `ar`, `fr` or `en` required when populated    | Separate publication toggle, off by default                                                              |
| Community role         | Optional: founder, aspiring founder, developer, designer, community builder or other            | Separate publication toggle; never grants a system permission                                            |
| Conversation interests | Up to five unique selections from a small shared, localized community-topic enum                | Separate publication toggle; no arbitrary taxonomy creation                                              |
| Languages spoken       | Zero to three unique values from `ar`, `fr`, `en`                                               | Separate publication toggle; distinct from UI language                                                   |
| Professional link      | One optional absolute HTTPS URL, maximum 2,048 characters; no credentials or unsafe schemes     | Separate publication toggle; external link with safe rel/referrer behavior; no server-side link previews |
| Hosted events          | Server-derived history, paginated and grouped by event market/city                              | Public event identity and evidence; no private RSVP or attendance history                                |
| Interface language     | `ar`, `fr`, `en`; reuse locale resolution                                                       | Private setting, propagated to server notifications                                                      |
| Contact and security   | Better Auth identity, verified contacts, linked providers, sessions                             | Owner-only; never included in public DTOs                                                                |

Optional details have individual publish switches. Switching one off immediately removes it from
public API responses, SSR output, metadata, previews and cached views. Clearing a field clears its
publish flag. An image imported by OAuth is not automatically published. Explain that previously
public content may already have been copied by visitors; visibility controls do not promise recall.

PF-02 uses the role keys `founder`, `aspiring_founder`, `developer`, `designer`,
`community_builder`, `other`; topic keys are `bootstrapping`, `product`, `design`, `engineering`,
`finding_customers`, `community`. Localization of those labels belongs to PF-04. Introduction limits
also count Unicode code points; counter behavior must match the schema, not HTML's UTF-16 length.
Existing opaque Better Auth user IDs remain valid; new asset IDs use the shared factory. Profile
and account preferences have independent nonnegative revisions and reject stale updates. Empty
optional fields normalize to null/empty arrays, clear their publication flags and, for introduction,
clear the authored language. Photo publication additionally requires an owned ready asset.

Event updates, reminders and host updates default enabled as category preferences; follow-up prompts,
push and SMS fallback default disabled. Category defaults are not channel consent. SMS consent time
is server-owned and requires a currently verified nonempty phone; withdrawing consent clears it.
`user.locale_pref` stays the only persisted interface locale; null retains cookie → market → `ar`
resolution. PF-08 must migrate existing delivery deliberately: PF-02 does not change active sending.

### Page structure

Keep `/profile` as the authenticated entry point, with accessible sections or nested routes for:

1. **Profile:** edit identity and optional introduction fields; save/cancel per section, explicit publish controls, read-only preview of the exact public projection.
2. **My activity:** owner-only links/lists for upcoming RSVPs and hosted events; reuse event actions and CO-owned closeout/feedback flows rather than duplicating them.
3. **Preferences:** interface language, notification categories, current-device push state, SMS fallback consent and a control to forget browsing location on this device.
4. **Account and security:** verified email/phone, enabled connected providers, sessions, sign out of this/other devices, export and deletion.

No home address, home city, map, residence hint or location completeness score appears on this page.
No followers, public no-show badges, public reviews, DMs, CVs, fundraising or company-stage fields.
A host badge reflects real hosting evidence; administrator/moderator permissions are not public profile labels.

### Editing and accessibility

- Keep field labels, counters, instructions, inline errors, first-error focus, `aria-live` save status and recoverable errors in all three locales. Do not use placeholder text as the only label.
- Handle loading, not found, permission denied, unavailable services and empty activity explicitly. Preserve entered values after failures; reject duplicate saves while pending.
- Use a server revision and conditional updates to detect stale edits in two tabs. Show a conflict with reload/reapply choices rather than silently overwriting newer changes.
- Warn about unsaved changes on navigation or locale switch. Preserve non-sensitive form drafts during reauthentication; never persist OTPs, session tokens or credential-change forms in local storage or URLs.
- Keep mobile actions reachable without covering fields or the keyboard; keyboard-only operation, dialog focus return, logical RTL spacing and 390/768/1280 layouts are acceptance gates.

## 4. Architecture, privacy and data model

```text
apps/ui routes (wiring)
  -> features/profile/components + hooks/query options
  -> features/profile/api.ts
  -> libs/server-fns/profile/*
  -> libs/domain/profile/* + libs/db profile repositories
  -> D1

Account operations: feature API -> shared authenticated facade -> libs/auth -> Better Auth/D1
Photos: feature API -> protected Worker -> R2 + Images through ImageProvider
Notifications: saved preferences -> existing notification producer/dispatcher + CO-02 delivery
```

Keep profile identity global under FR-A1. Event activity, host trust and notifications retain their
real market and geographic context. Never synthesize a home market just to satisfy a schema or log
field. PF-01 makes the global-identity exception explicit in AGENTS.md §6 and reconciles FR-G2;
global account requests log their global scope, with market context only when relevant.

### Persistence boundaries

- Keep Better Auth's `user`, `account`, `session`, `verification` as the identity source. Do not duplicate email, phone or authorization role in profile tables.
- Add a one-to-one profile record keyed by user ID for optional fields, authored locale, publication flags and revision. Treat it as a global identity extension, not geographic activity.
- Add owner notification preferences with explicit defaults and consent timestamps, plus an asset record for each owned photo with upload/processing/active/deletion state. Add session/device association for push subscriptions so account revocation can revoke delivery. Use shared ID factory and timestamp conventions.
- Add lifecycle/job records only for export/deletion work that needs durable progress. Use the existing operations processing infrastructure once available; no in-memory jobs and no new service without authorization.
- Define owner and public Zod response schemas. Explicitly select/project permitted fields; never spread a DB row into an RPC response or rely on TypeScript to remove fields at runtime.
- Profile mutations never accept a client-selected owner ID or system role. Public reads cannot expose banned/deleted identities or suppressed content; moderation visibility integrates with CO-09. Mutations atomically reject closing/deleted accounts so an in-flight save cannot repopulate data after deletion starts. PF-02 added the `user.account_state` column; **PF-03a makes every profile/preference mutation check it** as part of its eligibility predicate, and PF-10 owns the transitions that set it. Until PF-03a lands, the column is storage with no reader — do not assume a mutation written before then honours it.
- Use Drizzle repositories and atomic SQL/`db.batch`. Optimistic revision checks and last-login-method checks must remain correct under concurrent requests; no read/decide/write transactions across awaits.

### Planned feature interfaces

Names below are proposed contracts, not claims that these endpoints already exist. Each command uses
the shared domain schema through `features/profile/api.ts`; Better Auth operations use its existing
implementation behind the shared facade. Rate limiting today is per call site: each `rateLimit(...)`
names its own Durable Object bucket with inline counts and windows, and no central budget table
exists. PF-03a introduces one, with separate budgets for inexpensive edits, OTP sends and expensive
upload/export work, and a test that every profile/account mutation draws from a declared budget.
Until then, do not describe budgets as centrally governed.

| Interface                                     | Input/output and control                                                                                                                            |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getMyProfile` / `updateMyProfile`            | Owner DTO; allowlisted editable fields plus expected revision; return saved projection/revision; never accept owner/role/contact verification flags |
| `getPublicProfile` / `listHostedEvents`       | Validated user ID; explicit market filter and bounded cursor for event history; public projection only                                              |
| `getMyPreferences` / `updateMyPreferences`    | Validated locale/category/channel settings, SMS consent and revision; return actual saved policy                                                    |
| `uploadMyPhoto` / `removeMyPhoto`             | Bounded multipart body through protected Worker, owned asset ID and revision; return processing/active state; visibility stays explicit             |
| `getMyAccount` / contact verification actions | Masked contact/provider status; Better Auth verified change flow; recent action-bound proof and no secret-bearing responses                         |
| `listMySessions` / revoke actions             | Opaque owner-bound session IDs, current-session indicator; protect matching device delivery and invalidate auth/cache state                         |
| Provider link/unlink actions                  | Configured provider enum and validated return path; Better Auth linking and atomic last-usable-method guard                                         |
| Export request/status/download                | Idempotent owner-bound job, snapshot/schema version, expiry; no reusable public asset URL                                                           |
| Deletion request/status                       | Recent proof plus explicit confirmation; idempotent lifecycle job; restricted post-revocation receipt and no identity-data response                 |

Stable errors include validation failure, unauthenticated/forbidden, revision conflict, unavailable
provider, rate limit, verification failure/expiry and account closing. Use existing `AppError` codes
where appropriate; add genuinely new codes once in the shared core and translations. Guard every
write against account lifecycle state, validate server responses at the projection boundary and
reject unknown input keys that could become mass assignment as schemas grow.

### Cache and device boundaries

Owner/profile/account responses use private, no-store semantics and are excluded from the Serwist
runtime cache. Query keys include the identity and audience; no owner data may hydrate into a public
query. On logout/account switch clear private Query/Router state, account-bound drafts and push-token
ownership. Preserve an anonymous event draft only for its intended login handoff, never for a later
unrelated account. Update the navigation's Better Auth session cache after identity changes.

Public queries include the selected market filter and pagination cursor. Public field withdrawal,
photo removal, moderation and deletion invalidate server/CDN/Router/Query caches, not just the edit
screen. Start with non-cacheable visibility-sensitive responses if reliable purge is unavailable.
Do not expose hidden fields in Open Graph tags, JSON-LD, sitemaps, errors or logs. Minimal profiles
default to `noindex`; public event discovery remains unchanged.

### Migration away from home location

1. Inventory every live reference, auth additional field, session payload, fixture, loader, privacy string and export path; distinguish historical migration records from active code.
2. Deploy additive profile/preferences schemas and explicit response projection. Stop reading and writing home fields; retire `setHomeLocation` and geography onboarding safely. Old clients receive a typed refresh-required failure and cannot resume location writes.
3. After the deployed fleet no longer depends on the columns, apply a reviewed Drizzle migration to remove `home_market_code`, `home_state`, `home_city_id` and the relevant FK. Do not copy their values into a renamed preference/profile table. "No longer depends" is a **recorded Worker version on every environment**, not elapsed time; PF-03b names that version in its release evidence.
4. Test populated migration histories on local D1 and staging; verify users, sessions, events, RSVPs, market codes and FK integrity are preserved. Invalidate auth snapshots and cached responses containing the removed values.
5. **Test the intermediate state, not only the endpoints.** Between the PF-03a release and the PF-03b promotion, production runs code that never mentions residence against a schema that still has the columns and their FK — and that window is as long as the operator's confidence takes. `libs/db/src/setup.ts` applies `TEST_MIGRATIONS`, which includes the pending contraction, so every repository and RPC test currently proves only the _contracted_ schema. PF-03a adds a suite that builds the database from the migrations **minus** the contraction and runs the profile repositories, a user insert and an auth sign-in against it. The columns are nullable today, so the state is expected to be safe; the test is what keeps a later `NOT NULL` from breaking signup for the length of that window.
6. **Guard the quarantine mechanically.** `migrations/meta/_journal.json` and the 0021 snapshot are committed while `0021_remove_profile_residence.sql` sits in `libs/db/pending-migrations/`, so the next `db:generate-migrations` diffs against the contracted schema and emits an 0022 that assumes 0021 applied. A README is not a guard. PF-03a adds a test that fails when the journal names a tag whose `.sql` is absent from `libs/db/migrations/` and a later tag exists.
7. Historical SQL/snapshots remain immutable. Document existing backup retention and expiry; dropping active columns does not erase older backups. Restore procedures must rerun the privacy migration before serving traffic.
8. Roll back application behavior only to a location-independent compatible version. After data removal, never restore home data as an ordinary rollback. No remote migration runs as part of writing this plan.

## 5. Account security and service contracts

### Authentication and onboarding

Keep email OTP and configured Google/GitHub. After successful authentication, collect a missing
display name only; users with a valid name return directly to their original action. Both new-user
OAuth callbacks and OTP sign-in, including `HostSignInGate`, use the same completion rule. Collect a
missing name inside the host gate without redirecting away from its draft. Existing `/onboarding` links remain
safe entry points for this location-free flow. Reuse `sameOriginPathSchema`/`safeRedirectPath`, including
normalized-path protections; reject redirect loops through login/onboarding and cross-origin destinations.
Preserve the actual submission contract: inline host OTP may continue the publish the user already
requested, once only; OAuth restores the draft and retains the explicit Publish action. Generic
login, profile editing and account reauthentication never create an event or RSVP on their own.

### Mutation protection and credentials

- All new profile/account/asset/preference mutations require session, centralized permission, ownership, shared Zod validation, DO rate limiting and action-bound Turnstile as required by AGENTS.md. Use the existing shared Free-plan WAF coverage; verify endpoint coverage without adding paid-tier rule requirements.
- Inventory raw Better Auth endpoints as well as the facade. Generic update-user, contact changes, linking/unlinking, session revocation and deletion must not bypass validation, recent-auth requirements, rate limits or lifecycle rules by being called directly.
- Use Better Auth verification flows, never direct edits of verified email/phone columns. Require recent authentication and proof of the new contact; email change also proves the existing contact through the installed email-OTP configuration. Give an explicit recovery path if the old contact is inaccessible.
- Keep the old contact usable until the new one is verified. A uniqueness collision, failed OTP, expiry or provider error leaves the original identity intact; existing-email linking must never merge two users implicitly.
- Phone changes use authenticated verified update mode, not anonymous registration. Missing deployed Twilio credentials fail closed; no development OTP logging in staging/production and no new phone-login surface.
- Allow unlinking only if another verified usable login method remains. This check must be atomic under two concurrent unlink/change requests. OAuth must not overwrite member-edited names/photos or reset publication choices on later login/linking.
- Show session device/browser and dates; no geolocation or raw tokens in settings. Use owner-bound opaque session IDs in the UI, map to Better Auth internally, allow revoke-one/revoke-others and identify the current session.
- Reauthentication is a one-time, action-bound recent proof; do not treat a long-lived cookie as permanent proof. PF-07 session revocation also removes affected device push delivery using the association added by PF-02; PF-08 consumes that model rather than deferring revocation safety.
- Shared errors become stable localized messages. Log operation, actor, request, outcome and non-sensitive reason codes, never profile text, phone/email, OTPs, session secrets, export contents or photo bytes.

### Photos and Cloudflare provisioning

PF-06 must verify current official R2/Images documentation, account entitlements, pricing, billing caps
and staging/production resource isolation before provisioning. A Free Workers/WAF setup does not by
itself establish that image processing/storage is free. No cost figure or entitlement was verified in
this source audit. The provider interface does not prove a deployed Images pipeline exists.

Use Worker-mediated bounded uploads to an owned private R2 key, validate MIME plus actual decoded
format/dimensions, and reject SVG, animated content, malformed/polyglot files and excessive dimensions.
Normalize through the Images adapter, strip EXIF/GPS metadata and create bounded avatar variants.
Do not fetch arbitrary external image URLs or expose originals. Use immutable opaque versioned keys,
but serve through an endpoint that enforces the current asset/profile publication state with cache
policy compatible with immediate withdrawal. Never expose an unconditional long-lived public R2 URL.

Only activate a processed asset after it succeeds; preserve the prior photo on failure. Replacement,
removal, visibility withdrawal and account deletion make old public URLs unavailable. Retrying cannot
delete the current photo or leave unlimited orphan uploads. Track abandoned assets and clean them
with bounded durable recovery. Match production provider behavior with real local R2 tests and
provider-interface test doubles for external transforms; no fake deployed adapter.

### Notifications and delivery

Preferences cover event confirmations/changes, reminders, host RSVP updates and CO-owned follow-up
prompts. Authentication/security messages remain a separate necessary category, explained in the UI;
no marketing opt-in is bundled with joining. Optional event delivery can be disabled, with a clear
statement that event information remains available in the app.

Push is first choice; SMS fallback requires a verified phone and affirmative consent. Show separate
states for unsupported browser, not installed where installation is required, not requested, denied,
granted but unregistered, registered and delivery unavailable. Permission prompts follow a user
gesture; a switch cannot override a browser denial. Removing phone/consent disables fallback without
silently enabling another channel. Existing email-specific messages retain their explicit purpose.

Apply preferences and current verified destination both when producing and immediately before
dispatching. A queued payload must not send to a removed phone, withdrawn channel, revoked device or
deleted account; recheck fallback eligibility after primary failure. Producer, dispatcher and recovery
must share the same policy. Do not build another scheduler: CO-02 owns DO alarms and Queue delivery.

### Export, deletion and retained community evidence

Export is owner-only after recent authentication. Generate a bounded, paginated JSON archive containing
identity, optional fields/publication settings, contacts/preferences, own activity and authored data.
Exclude secrets, other members' PII and restricted moderation/security records; state any omissions.
Use private delivery with short-lived, owner-authorized access and expiry; never email a public export URL.

Deletion is an explicit confirmed action after reauthentication, implemented as an idempotent durable
workflow. Proposed states are requested, processing, needs-review and completed, with actionable
status for failures. Immediately disable authentication, revoke all sessions, stop personal delivery,
hide the public profile and remove public assets; do not claim full erasure while processing remains.
Return a short-lived, opaque deletion-status receipt whose server-side record permits only a minimal
status read after sessions are revoked. Store it securely, never in a public URL, and never allow it
to access account data or reverse deletion. Restricted admin status/recovery remains available after
receipt expiry. Public UI clearly distinguishes completion from processing or review.

For future hosted events, use the existing cancellation service and deliver cancellation notices to
affected attendees. Do not silently transfer hosting. Cancel the departing member's future RSVPs with
atomic counter handling; respect immutable eligibility at/after event start. Events already running
or awaiting closeout become an admin attention case without keeping the public profile active.

Preserve event facts and required operations records under the existing NFR-5/CO retention policy,
with pseudonymous references and private restricted access where retention is necessary. Pseudonymous
data remains protected personal data while linkable. Remove optional profile content, credentials,
contact details, subscriptions, queued PII payloads and photo/export assets when permitted. Do not
delete the raw user row until FK behavior has been migrated and all dependent data is handled.

CO retention remains: closeout/attendance/structured feedback/weekly reviews/audit 24 months; feedback
comments 12 months; trust for account lifetime and 24 months after closure/last transition; non-PII
monthly aggregates indefinitely. This plan invents no new legal retention period. Maintain bounded
restricted tombstones only when needed to enforce that policy, then purge them. Backup expiry and
restore-time reapplication of deletions belong in the runbook. An erased user's ID is never re-registered:
Better Auth mints opaque random identifiers, so accidental reuse is not a realistic collision, and the
guarantee that matters is the restricted tombstone that refuses the identifier at signup. The tombstone
carries no profile data and is bounded by the retention policy above, then purged with it.

## 6. Tickets and acceptance gates

Each ticket is one reviewable mission/PR with its own tests. Four stages were too large to review as
a single PR and are split into lettered tickets: PF-03a/b, PF-04a/b/c, PF-07a/b/c and PF-11a/b. The
stage numbers keep their meaning — nine other documents cite `PF-04` and `PF-11`, and a dependency on
`PF-04` means the whole stage — so nothing is renumbered. PF-01 and PF-02 are complete locally and
audited; PF-03a is in progress on the working tree; PF-03b onward remain planned. Parent P1-004 owns the
profile lane; P1-003 owns auth changes, P1-009 delivery integration, P1-013 moderation integration,
P1-018 security and P1-021 release evidence. Requirements below reference the SRS, including the
new approved profile/account requirements; writing this document does not mark their code complete.

### PF-01 — Freeze contracts and reconcile integration boundaries

**Requirements:** FR-A1 through FR-A11, FR-G2; NFR-5, NFR-10. **Depends on:** none.

**Status:** Complete locally, 2026-09-08. Field contracts, global identity exception, consumer
inventory and recorded EC handoff reconciliation are captured in §9. No live service verification
or event-security policy change was performed.

- Adopt the field/visibility contracts, narrow global-identity exception and location-free completion rule in the engineering/SRS references before code changes.
- Reconcile recorded EC status with its release evidence; the EC plan reports EC-10 complete but an outstanding production smoke action, while the roadmap/CO baseline retain older status. Do not invent live completion evidence or silently reorder CO work.
- Inventory affected tables, query keys, auth endpoints, current policies, image resources, notification contracts and data deletion dependencies. Identify any new dependency/service approval before installation.
- Acceptance: traceability and endpoint/field matrices reviewed; no unknown home-location consumer, duplicate ownership or unresolved contract hidden as implementation work.

### PF-02 — Add profile, visibility and preferences persistence

**Requirements:** FR-A1, FR-A6, FR-A7, FR-A9, FR-A11; NFR-4, NFR-5, NFR-10. **Depends on:** PF-01.

**Status:** Complete locally and audited, 2026-09-08. Migration `0020_profile_foundation.sql`
is additive and has not been applied to staging or production. Endpoint/UI wiring remains PF-03/04.

- Add shared Zod schemas, enums, field limits, explicit DTOs, profile revision and publication defaults; keep auth data authoritative in Better Auth.
- Add Drizzle migrations/repositories for profile, preferences, asset metadata and session/device subscription association; initialize old users with no optional public disclosure. PF-07/08 require fresh registration or safe withdrawal for legacy unassociated subscriptions before enforcing the new delivery policy; PF-02 leaves existing delivery untouched and never guesses session ownership.
- Acceptance: real D1 fresh/populated migrations, idempotent initialization, nullable clearing, concurrent revision conflict and immutable ownership tests pass. Auth/session rows remain usable.

### PF-03a — Replace profile API and remove location onboarding

**Requirements:** FR-A3, FR-A4, FR-A6, FR-A7; NFR-4, NFR-7, NFR-10, NFR-11. **Depends on:** PF-02.
**Status:** in progress on the working tree, uncommitted.

- Split the legacy profile server module into small RPC/resolver/repository responsibilities; add owner/public projections and complete mutation protection. Retire the location mutation to a typed `client_refresh_required` tombstone rather than deleting the route.
- Remove geographic loaders, auth completion checks and redirects from standalone OTP/OAuth/onboarding and the inline host gate; ask only for a missing display name. Preserve normalized safe return paths, drafts and the already-requested inline publish intent.
- Stop every active home read/write and drop the fields from the auth payload. **No column is dropped in this ticket** — the schema contraction ships separately as PF-03b under the staged procedure in §4. No residence is backfilled from browsing or event attendance.
- Add the shared rate-budget table §4 describes and route every profile/account mutation through it; add the `user.account_state` eligibility check to every profile/preference mutation.
- Add the two safety tests §4 steps 5 and 6 require: repositories and auth exercised against the pre-contraction schema, and the journal/pending-migration quarantine guard.
- Acceptance: all supported auth paths return correctly; users with no location can edit, create and RSVP; no home value appears in any public, private or auth response; valid event geography and history unchanged; the pre-contraction suite and the quarantine guard both run in CI; `npx nx run-many -t typecheck lint test build` is green before review.

### PF-03b — Promote the residence contraction

**Requirements:** FR-A3; NFR-4, NFR-5, NFR-10. **Depends on:** PF-03a deployed to every environment.

This is the plan's only irreversible data action and it gets its own ticket so it cannot ride along
inside a feature PR. It is a release, not a code change: the SQL is already written and reviewed.

- Confirm and record the deployed Worker version on staging and production, the D1 recovery point and the compatible rollback version, per §4 step 3.
- Move `0021_remove_profile_residence.sql` unchanged from `libs/db/pending-migrations/` into `libs/db/migrations/`, then apply it through the canonical worker-jobs Wrangler config. Never split the file into separate executions.
- Acceptance: staging rehearsal on populated data first; users, sessions, events, RSVPs, market codes and FK integrity preserved; home columns absent from the live schema; auth snapshots and cached responses carrying removed values invalidated; the quarantine guard passes again with the file promoted. **Deployment is user-triggered — this ticket is prepared, never executed on the implementer's initiative.**

### PF-04a — Profile shell and identity editing

**Requirements:** FR-A6, FR-L1 through FR-L5; NFR-8, NFR-9. **Depends on:** PF-03a.

- Move profile components to `features/profile/components`; add section navigation and shared query options with owner-keyed cache keys and centralized invalidation.
- Implement display-name editing with save/cancel per section, revision conflict handling with reload/reapply, preserved values after failure, rejected duplicate saves while pending, and `aria-live` save status.
- Acceptance: save, cancel, conflict, failure and pending states each have a test; invalidation refreshes the owner view and session-derived navigation identity; keyboard and RTL/LTR component tests pass.

### PF-04b — Optional fields and per-field publication

**Requirements:** FR-A6, FR-A7, FR-L1 through FR-L5; NFR-5, NFR-8. **Depends on:** PF-04a.

- Implement introduction, community role, conversation interests, spoken languages and professional link against the frozen PF-01 contracts, including code-point counters that match the schema rather than UTF-16 length.
- Implement the individual publish switches, the rule that clearing a field clears its flag, and a read-only preview of the exact public projection.
- Acceptance: every field can be saved and cleared; switching publication off removes the field from the public projection in the same test that asserts the owner still sees it; the preview and the public API agree field for field.

### PF-04c — Hosted event history

**Requirements:** FR-E7, FR-A6; NFR-5, NFR-9. **Depends on:** PF-04a.

- Implement private activity links and paginated hosted events with explicit market filters. Replace the current upcoming-list length used as a hosted count; counts come from an aggregate over the same documented predicate.
- Until CO-03/05 provide held evidence, label elapsed events as past, not completed. Add held/did-not-happen labels from the CO contract when available; never expose member attendance.
- Acceptance: pagination covers every hosted event, the count and the list agree under the same predicate, and no RSVP or attendance of any member appears in a public response.

### PF-05 — Close cache, moderation and alternate-path privacy gaps

**Requirements:** FR-A6, FR-A7, FR-M2; NFR-4, NFR-5. **Depends on:** PF-04a, PF-04b.

- Audit SSR, search metadata, APIs, session snapshots, service worker caches, exports and logs for implicit disclosure. Add no-store/private boundaries and logout/account-switch cleanup.
- Enforce publication and existing moderation restrictions server-side. Share CO-09 visibility decisions instead of creating a second moderation system; implement that adapter when CO-09 lands.
- Protect raw update-user endpoints from mass assignment and preserve user edits across OAuth refresh/linking. Public system roles and contact-derived name fallbacks are forbidden.
- Acceptance: two-account isolation and cached-withdrawal tests, direct RPC/Better Auth bypass tests, anonymous/public DTO contract tests and suppressed/deleted-profile tests pass. **The public DTO contract test is a CI gate that fails on any newly public field** — it asserts the exact key set of every public projection, so adding a field to a response without adding it to the test is a red build. This is the plan's primary defence against accidental disclosure; Playwright stays outside CI and PF-11b's locale pass is too late to be the first place a leak is noticed.

### PF-06 — Deliver managed profile photos

**Requirements:** FR-A11, FR-A6; NFR-4, NFR-5, NFR-8, NFR-12. **Depends on:** PF-02, PF-03a, PF-05.

- Verify R2/Images entitlements and cost, implement the provider, provision isolated approved resources, and declare local/staging/production bindings and types using existing Wrangler conventions.
- Build accessible upload/preview/replace/remove with bounded server validation, normalization, metadata removal, private originals, publication-aware delivery and orphan cleanup.
- Acceptance: malformed/oversized uploads fail safely; user B cannot read/manage user A's private assets; old URLs fail after withdrawal; replacement failure retains the old image; real local R2 and staged Images behavior verified. No upload control ships before the real provider works.

### PF-07a — Dispatcher current-destination and lifecycle guard

**Requirements:** FR-A8, FR-E8; NFR-4, NFR-5. **Depends on:** PF-02.

This is delivery-path work, not account settings. It was previously a bullet inside the contact and
session ticket, where it would have been reviewed by whoever reviews settings UI. PF-07b, PF-07c,
PF-08 and CO-02 all consume it, so it stands alone and lands first.

- Add a shared guard in the existing dispatcher that resolves the current eligible destination immediately before sending, so a queued payload cannot reach a removed contact, a revoked device or a closed account.
- Acceptance: real local Queue/DO/D1 tests show a payload queued against a since-removed phone, a since-revoked session and a since-closed account is dropped rather than delivered, and that fallback eligibility is rechecked after a primary failure.

### PF-07b — Verified contact changes

**Requirements:** FR-A4; NFR-4, NFR-5, NFR-7. **Depends on:** PF-03a, PF-05, PF-07a.

- Configure the installed Better Auth email and phone update flows with recent-action verification through shared protected adapters. Never edit verified contact columns directly.
- Keep the old contact usable until the new one is verified; a collision, failed OTP, expiry or provider error leaves the original identity intact and never merges two users. Give an explicit recovery path when the old contact is inaccessible.
- Acceptance: success, failure, collision, stale-proof and expiry tests pass; missing Twilio credentials fail closed; no OTP or token appears in any response or log.

### PF-07c — Login methods and session controls

**Requirements:** FR-A8; NFR-4, NFR-5, NFR-7. **Depends on:** PF-07b.

- Implement provider linking/unlinking and masked session summaries with owner-bound opaque session IDs, a current-session indicator and revoke-one/revoke-others.
- Prevent lockout, privilege escalation, bypass through direct auth endpoints and OAuth overwrites of member-edited names, photos or publication choices.
- Acceptance: concurrent last-usable-method removal is rejected atomically; own- and other-session revocation removes matching device delivery through the PF-07a guard; no DTO carries a token; real provider staging checks pass.

### PF-08 — Connect preferences to real notification delivery

**Requirements:** FR-A9, FR-E8, FR-L3, FR-L6; NFR-4, NFR-5, NFR-9. **Depends on:** PF-04, PF-07a (the guard, not the whole of PF-07) and CO-02.

- Persist locale with cookie/session/SSR consistency, channel/category preferences and SMS consent. Model device/session subscription ownership and expose browser permission/service states truthfully.
- Reuse producer/dispatch/fallback policy and CO-02 alarm/Queue infrastructure. Resolve current eligible contact at dispatch, and remove delivery to revoked sessions/devices, signed-out shared devices or deleted users.
- Acceptance: real local Queue/DO/D1 tests show opted-out categories never dispatch, push failure uses only eligible SMS, queued old contacts are not used, and all three locales are honored. Verify enabled providers on staging before labeling controls operational.

### PF-09 — Implement private data export

**Requirements:** FR-A10; NFR-4, NFR-5, NFR-7. **Depends on:** PF-05, PF-07b.

Export deliberately does **not** depend on PF-06. Photo storage is gated on R2/Images entitlement and
cost that §5 says were never verified, and a member's ability to take their data out should not inherit
a provisioning decision that may not survive its own cost review.

- Implement an owner-authorized, bounded snapshot/export with durable progress if required, explicit field allowlists, short-lived download access, expiry and cleanup.
- Until PF-06 lands, the archive lists photo asset metadata and states plainly that no binary is included; the export's stated omissions are part of its contract. Photo bytes join the archive with PF-06 and bump the snapshot schema version.
- Include CO-owned data through its repositories when those schemas exist; require corresponding adapters before releasing an export that claims completeness for that schema version.
- Acceptance: two users cannot access each other's exports; secrets/other members' data stay absent; pagination covers all permitted rows; expired/deleted-account downloads fail; retries and cleanup work.

### PF-10 — Implement safe account deletion and retention

**Requirements:** FR-A10, FR-E12; NFR-4, NFR-5, NFR-7. **Depends on:** PF-07c, PF-08, PF-09 and the applicable CO-03/05/06/09 persistence/cancellation/retention adapters.

- Migrate unsafe cascade relationships — ten tables currently cascade off `user.id` — and implement lifecycle state, immediate access withdrawal, upcoming event/RSVP handling, retained pseudonymous history and idempotent asset/notification cleanup. The asset-cleanup step is a verified no-op until PF-06 exists; deletion does not wait for photo storage.
- Add crash recovery, admin attention for unresolved event/retention cases, private progress and expiry/purge routines. Block raw Better Auth deletion from bypassing the lifecycle.
- Acceptance: deletion retries converge; active sessions fail immediately; future RSVP counters stay correct; start-time eligibility remains frozen; attendee notices survive host removal; event/CO aggregates remain truthful; no deleted-account notification or public asset is delivered.

### PF-11a — Integrate CO outcomes

**Requirements:** FR-E7, FR-E12, FR-M2; NFR-9. **Depends on:** PF-04c, PF-10 and the relevant CO contracts.

- Integrate held-event history, moderation suppression, own closeout/feedback links and full export/deletion coverage without duplicating CO actions. No public individual attendance or private feedback.
- Acceptance: held and did-not-happen labels come from the CO contract rather than local inference; a suppressed profile is suppressed in every projection; no CO action is reimplemented here.

### PF-11b — Finish localized account UX

**Requirements:** FR-A6 through FR-A11, FR-L1 through FR-L6; NFR-8, NFR-9. **Depends on:** PF-11a.

- Audit the complete app navigation, privacy/cookies/help content and all account/photo/provider/error/empty states in Arabic, French and English. Replace the old claim that home location is collected.
- Acceptance: 390/768/1280 screenshots and keyboard flows for each locale; new/existing/member/host/closed-account journeys; no horizontal overflow or hidden action, no untranslated labels, no inaccessible errors. This is a manual pass by design — it is the last check, never the first place a privacy or contract regression is caught.

### PF-12 — Verify, migrate and release with evidence

**Requirements:** NFR-4, NFR-5, NFR-8 through NFR-12. **Depends on:** PF-01 through PF-11b, and PF-03b promoted.

- Run the verification matrix below; rehearse additive/contract migrations and failed-job recovery on populated staging data. Confirm resource isolation, provider configuration, WAF coverage and no deployed bypass/test endpoints.
- Rerun the event creation auth-return and RSVP regression gates after onboarding changes. Record exact deployment version, migrations, anonymous/owner API samples, image withdrawal and notification/account-lifecycle evidence.
- Release with existing CI/deploy workflow only after required approval. Keep code-ready, deployed and verified statuses distinct; never mark the whole plan complete while a provider or destructive-data gate is deferred.

## 7. Relationship to existing plans and sequencing

- EC owns event creation, venue/schedule persistence and submission. PF-03a changes only identity completion/return wiring; it must rerun EC regressions, including the current inline OTP continuation, and must not reintroduce location onboarding or silently alter the current event security decision.
- CO retains its existing immediate-after-EC priority. This plan adds a P1-004 lane and does not authorize silently replacing CO-01 as the next mission. Selecting a PF ticket for execution is a separate task from writing this plan.
- PF-01 through PF-07c can progress independently of CO delivery once their own dependencies are satisfied. PF-08 waits for CO-02; PF-09/10 require adapters for every deployed operational schema; PF-11a completes the CO-facing integration. None of these dependencies makes CO depend on the full profile redesign.
- PF-03b is a release, not development work. It can wait indefinitely behind PF-03a without blocking any other ticket: everything downstream reads the contracted Drizzle schema, and the residual columns are inert. Do not treat a long quarantine as a problem to rush.
- CO-03 designs retained references and deletion-compatible FKs; CO-05 owns closeout evidence, CO-06 feedback, CO-09 moderation/trust. PF owns member controls, public projection and account lifecycle orchestration; no duplicate retention or authorization implementation.
- PF-01 reconciles event/CO status from dated repository release evidence, not a new live verification. EC-10 has recorded staging completion and production release evidence; its authorized production creation smoke remains outstanding before final handoff. The user's 2026-09-08 request explicitly starts the supporting PF foundation without claiming CO implementation or that smoke occurred.

Recommended execution order inside this lane is PF-01 → PF-02 → PF-03a → PF-04a → PF-04b → PF-04c →
PF-05, then PF-06 and PF-07a → PF-07b → PF-07c in parallel, then PF-08 → PF-09 → PF-10 → PF-11a →
PF-11b → PF-12 when CO dependencies permit. PF-03b is scheduled by the operator once PF-03a has been
live on every environment long enough to record the version. Ship each vertical slice only when its
behavior is real; unfinished services do not get inert settings controls.

## 8. Verification matrix and completion checklist

| Layer                 | Required evidence                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain                | Unicode limits, clearing, visibility projection, allowed links/enums/locales, ownership and notification/deletion policy                                |
| D1/Miniflare          | Populated migrations, FK integrity, conditional saves, concurrency, session/device ownership, deletion/counter/retention invariants                     |
| Pre-contraction state | Repositories, user insert and auth sign-in against the schema **without** the pending contraction — the state production runs between PF-03a and PF-03b |
| Migration quarantine  | A journal tag with no `.sql` in `migrations/` fails the build when a later tag exists, so a pending contraction cannot be silently built on             |
| Server/auth           | Every mutation's permission/rate-limit/Turnstile failures; raw auth endpoint bypass; fresh proof; no mass assignment; no public PII                     |
| R2/Images             | Owned private originals, real local bucket, staged transforms, metadata stripping, quota limits, failure recovery, withdrawn URL denial                 |
| Delivery              | Current preferences/contact at production and dispatch, eligible fallback, revoked-device/deleted-user suppression, durable retries                     |
| Components            | All states, error focus, save/cancel/conflict, keyboard dialogs, field publication, locale changes, private session/token handling                      |
| Browser local/staging | OTP/OAuth location-free onboarding; create draft return; edit/public preview; photos; contact verification; session revoke; opt-out; export/delete      |
| Privacy               | Anonymous vs owner vs second user, SSR/metadata/SW/cache/log inspection, old-photo access, sign-out/account-switch isolation                            |
| Release               | Versioned evidence, migration runbook, provider/WAF checks, sanitized artifacts and tested rollback/recovery                                            |

Everything above except the browser and release rows runs in CI. The public DTO contract test, the
pre-contraction suite and the quarantine guard are gates, not advisory checks: a leak, a broken
intermediate schema or a silently-built-on quarantine must fail a build, because Playwright is
outside CI and the locale pass in PF-11b happens after every other ticket has shipped.

Run `npm run format:check`, `npx nx sync:check`, `npm run typecheck`, `npm run lint`, `npm run test`
and `npm run build` as appropriate to each implementation slice. Use `npx nx run db:generate-migrations`
and the existing `migrate:local`/staging/production targets for reviewed migrations. Run public-app
Playwright through `npm -w apps/ui run e2e`; E2E remains excluded from CI. Use real Miniflare Cloudflare
bindings; external-provider doubles are permitted only behind their interfaces in tests. Do not
weaken bot controls, echo deployed OTPs or add test-only production routes to make the browser gate pass.

- [ ] No profile residence collected, exposed or retained in active home columns.
- [ ] Authentication and event/RSVP return flows work without optional profile completion.
- [ ] Every editable field and publication switch works end to end; global identity and market activity remain distinct.
- [ ] Photos, sessions, contact verification and preferences use the configured real services and fail truthfully.
- [ ] Public/API/cache/asset projections never expose private fields or personal attendance.
- [ ] Export/deletion cover all deployed schemas and preserve only the existing policy's permitted evidence.
- [ ] Tests, lint/boundaries, typecheck, formatting, builds and local/staging browser evidence pass.
- [ ] SRS, auth/privacy/cookie copy, roadmap and cross-plan evidence match what actually shipped.
- [ ] Code-ready, deployed and live-verified milestones remain distinct; no provisioning, remote migration, commit or push is implied by a local implementation milestone.
- [ ] No deploy, push or remote migration happens without the owner asking for it by name — including PF-03b, which is prepared and left waiting.

## 9. PF-01/02 implementation audit — 2026-09-08

### Contract and integration inventory

| Consumer / boundary                | Audited files or contracts                                                                                                       | Follow-up owner                                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Identity storage and auth payloads | `libs/db/src/schema.ts`; `libs/auth/src/auth.ts` additional home fields; `libs/db/src/db.test.ts` fixture                        | PF-03 removes active home fields after compatible deployment; historical migrations remain immutable            |
| Profile reads/writes               | `libs/server-fns/src/profile.ts` and barrel; `features/profile/api.ts` / `hooks.ts`; owner/public DTOs and `setHomeLocation`     | PF-03 replaces unsafe projections and mutation; session-derived owner, no client-selected owner                 |
| Location UI and completion         | `routes/profile.tsx`, `routes/onboarding.tsx`; `ProfilePage`, `OnboardingPage`, `LoginPage`                                      | PF-03 removes geography and completion gate                                                                     |
| Public identity and events         | `routes/u.$userId.tsx`, `PublicProfilePage`, event host identity                                                                 | PF-03/04 explicit public projection, no contact fallback, correct event pagination/aggregates                   |
| Inline authentication              | `HostSignInGate`, `useHostCreateWizard`, safe redirects and wizard draft                                                         | PF-03 preserves OTP pending-publish continuation and OAuth explicit Publish                                     |
| Copy                               | `libs/i18n/messages/{ar,fr,en}.json` onboarding/profile keys; `apps/ui/src/content/company/privacy.ts` localized privacy content | PF-03 updates onboarding; PF-11 completes runtime legal/help copy with shipped behavior                         |
| Cache isolation                    | Current `['profile','me']` and `['profile','public',userId]`; Better Auth session cache, event-created cache, Router/Serwist     | PF-03/04 owner-keyed queries and invalidation; PF-05 full SSR/metadata/cache withdrawal audit                   |
| Better Auth alternate endpoints    | Update-user, email-OTP change, phone-number update, link/unlink, list/revoke sessions, delete-user                               | PF-05/07/10 protect raw paths as well as facade; no second OTP implementation                                   |
| Photos                             | Existing `ImageProvider`, absent public R2/Images bindings, new owned `profile_assets`                                           | PF-06 verifies entitlement/cost before approved provisioning and implements processing/cleanup                  |
| Delivery                           | Existing push RPC/provider, notification producer/dispatcher/sweeper, deployed-environment Queue consumers, no DO alarm producer | CO-02 owns scheduling; PF-07 revocation/current destination guard; PF-08 preferences at production and dispatch |
| Retained data                      | Cascading user FKs to events/RSVPs/notifications; future CO-03/05/06/09 data                                                     | PF-10 must replace unsafe raw deletion; no deletion endpoint added here                                         |

This inventory intentionally distinguishes home fields from event geography and device browsing
preferences. Existing `back_home` navigation copy is unrelated and is not a residence consumer.
New profile-contract rejection tests and the additive migration test retain explicit legacy names
as safety assertions; PF-03 must not erase those assertions as if they were active collection.

### Recorded event handoff reconciliation

The EC plan's 2026-09-03 release verification records 18/18 staging browser cases, three persisted
events, request/log correlation and cleanup. `deployment-evidence.md` records production v0.1.0
on 2026-09-04, its DNS/WAF verification, then v0.2.0/v0.3.0. The later records supersede old claims
that staging creation or production DNS was still blocked. The authorized production creation smoke
is explicitly still outstanding. Roadmap, release strategy and CO baseline now distinguish those
facts. No deployed auth challenge was weakened and no production event was created during this audit.
The existing event-create Turnstile exception is documented, not extended to new profile endpoints.

### Foundation boundaries and migration safety

- Shared domain schemas and public allowlist projection are independent of I/O. Owner optional
  fields never become public by default, and unknown mutation keys are rejected.
- New tables: `member_profiles`, `account_preferences`, `profile_assets`, `push_session_links`;
  an additive `user.account_state` supports future lifecycle guards. Better Auth remains identity
  and locale authority. This column alone does not implement account deletion or auth revocation.
- Display name/profile and locale/preferences saves use conditional revisions inside real D1
  batches. Both statements share the eligibility predicate; failed writes roll back both changes.
  Missing defaults are separate idempotent atomic inserts, not an interactive transaction. Retrying
  partial initialization repairs the missing row without overwriting edited fields.
- Composite foreign keys prevent another owner's asset/session/subscription from being attached.
  Asset publication requires `ready`; reservation/read are real D1 operations but do not pretend
  that an R2 upload or image processing already exists.
- Session links record only actual owner-matched live sessions. Deleting a session cascades the
  association, not the existing subscription: removing its delivery is PF-07, with dispatch-time
  enforcement and legacy-registration migration in PF-07/08 before the controls ship.
- Apply `0020_profile_foundation.sql` before deploying code that uses the expanded user schema.
  Old users receive empty private fields and no new channel consent; no residence or OAuth image is
  copied. No home column is dropped until PF-03. Roll back code if necessary while retaining the
  additive tables; do not reverse the migration by deleting newly entered data.
- Tests apply the complete migration history on fresh Miniflare D1 and rehearse the populated
  pre-0020 database. No new dependency or cloud resource has been installed/provisioned.

### Verification results

**These results are the evidence for commit `057d37f` (PF-02), captured 2026-09-08. They are not a
statement about the current working tree.** As of 2026-09-09 the tree carries in-progress PF-03a work
and `public:typecheck` fails: `apps/ui/src/features/profile/components/ProfileNameEditor.test.tsx`
passes `exact: true` inside `ByRoleOptions` at lines 28, 29 and 41, and that option does not exist —
a string `name` already matches exactly. PF-03a is not reviewable until the full sweep is green again.

| Check                                                   | Result                                                                                                                                                               |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository typecheck, lint/Nx boundaries, tests, builds | Passed: `npx nx run-many -t typecheck lint test build`, 17 projects, 66 tasks; 42 valid cache hits in the final full run                                             |
| Domain                                                  | 162 tests passed; 100% line/function coverage and existing statement/branch gates passed                                                                             |
| D1                                                      | 72 tests passed on real Miniflare D1, including populated migration, preserved sessions/RSVPs, CAS races, rollback, clearing and cross-owner asset/session rejection |
| Schema/snapshot consistency                             | `nx run db:generate-migrations --skip-nx-cache` reports no schema changes after the reviewed migration                                                               |
| Formatting and workspace synchronization                | `npm run format:check` and `npx nx sync:check` passed after final formatting                                                                                         |
| Diff and source size                                    | `git diff --check` passed; new source/test files remain below 300 lines; schema retains its existing explicit exemption                                              |
| Production browser / E2E                                | Not run for this persistence-only slice; no new UI/RPC shipped. PF-03/04 retain browser/auth-return requirements; E2E remains outside CI                             |

Audit corrections included Drizzle's full-column requirement for insert/select and its unsupported
parameterized raw-query batching path: default initialization now uses independently idempotent,
conditional SQL inserts, while revision-sensitive edits use supported Drizzle query-builder batches.
The D1 tests verify those actual execution paths. New tests introduce no lint warnings; existing
warnings in unrelated tests/build dependencies remain and were not suppressed. These passing gates
are evidence for the completed foundation, not a guarantee that the unfinished account feature is
bug-free or already available to members.

### Review of 2026-09-09

This plan was reviewed against the tree on 2026-09-09 and amended in place. What changed: the status
header and the §2 audit table now say which state they describe; the false claim that PF-01 declared
rate budgets centrally is replaced by the real per-call-site position and a PF-03a deliverable;
`user.account_state` and the erased-ID guarantee have named owners and accurate wording; §4 gained the
intermediate-state test and the quarantine guard; PF-03, PF-04, PF-07 and PF-11 were split into
reviewable tickets without renumbering the stages other documents cite; the dispatcher guard became
PF-07a instead of a bullet inside a settings ticket; export and deletion no longer wait on photo
provisioning; the public DTO contract test became a CI gate; and the irreversible contraction became
PF-03b, a release ticket that nobody executes without being asked.

Next ticket: **PF-03a** — starting with the typecheck failure recorded above.
