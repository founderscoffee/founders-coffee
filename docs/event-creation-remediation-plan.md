# Event Creation Remediation Plan

| Field          | Value                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| Status         | Active; EC-01 and EC-02 complete, EC-03 through EC-10 not started                                                   |
| Last reviewed  | 2026-08-31                                                                                                          |
| Scope          | Authenticated host event creation in `apps/ui`, from route entry through durable D1 persistence and discoverability |
| Parent tickets | P1-005, P1-006, P1-018, P1-019, P1-021                                                                              |
| Requirements   | FR-G2, FR-G3, FR-G6, FR-E1, FR-E2, FR-E5, FR-E7, FR-E9; NFR-4, NFR-7, NFR-8, NFR-9, NFR-10, NFR-11, NFR-12          |
| Related plans  | [Implementation plan](./implementation-plan.md), [Events system plan](./events-system-plan.md)                      |

## 1. Objective

Make event creation a complete production vertical slice:

```text
authenticated host
  -> visible market and valid city
  -> localized venue, schedule, and event details
  -> shared Zod validation
  -> Turnstile and identity-scoped rate limiting
  -> authorized server function
  -> atomic, complete D1 persistence
  -> created event detail and city-feed discoverability
  -> structured logs and events-created metric
```

Completion means a host can create an event with every field required by FR-E1, in `ar`, `fr`, or `en`, with correct market-timezone conversion and venue coordinates, and can immediately open the persisted event. It also means invalid, unauthorized, automated, cross-market, and duplicate-slug attempts fail safely.

This plan does not change the locked stack, add a dependency, introduce another external service, implement paid events, or expand the separate sponsor/admin applications. Mapbox and Turnstile are existing approved integrations. E2E remains excluded from CI under the current project decision; the critical Playwright flow is still required as a local and staging release gate.

## 2. Audit baseline

The current implementation is a partial vertical slice, not an end-to-end-complete feature.

### What already works

- The public app has a three-step host route and renders the venue, schedule, and details screens.
- Mapbox renders and venue selection works in the deployed staging UI.
- The feature hook and API call the event server function through the required UI data-flow layers.
- The create server function requires the host permission and uses the Durable Object rate limiter.
- The resolver writes an event to D1 and the event read paths can display persisted events.
- Event, server-function, and repository lint/typecheck/build targets pass; the existing D1-backed repository and server-function tests pass.

### Gaps to close

| Area              | Current inconsistency                                                                                                                                       | Required outcome                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Required fields   | The wizard submits `capacity: 0`, derives language from the UI locale, and hardcodes `coffee-meetup`; no capacity, language, or category control is shown.  | The host explicitly chooses capacity, event language, and category using the shared schema. Unlimited capacity remains an explicit supported choice. |
| Venue persistence | The selected address and coordinates are held in the browser but only the venue name is submitted.                                                          | Persist the exact selected venue name, formatted address, latitude, and longitude.                                                                   |
| Timezone          | The picker labels `Africa/Algiers` and constructs timestamps in the browser's local timezone.                                                               | Display and convert using the selected market's configured IANA timezone, independent of browser timezone.                                           |
| Schedule validity | The server checks only that timestamps are positive.                                                                                                        | Reject past starts, `end <= start`, and durations outside the agreed event bounds in the shared schema/domain rules.                                 |
| Geography         | The resolver checks that state and city exist independently but not that the city belongs to the submitted state/market; it trusts client geography fields. | Resolve the visible market and canonical city server-side, derive `state_code`, and reject cross-market or disabled-event creation.                  |
| Slug integrity    | Slug selection uses read-before-write and the database has no uniqueness constraint for the event route key.                                                | Enforce a D1 unique index on `(market_code, slug)` and make collision handling atomic and bounded.                                                   |
| Bot protection    | Event creation has authz and the DO rate limiter but no Turnstile verification.                                                                             | Verify a single-use Turnstile response at the server boundary and forward `CF-Connecting-IP` as `remoteip`; retain DO and WAF layers.                |
| Map data flow     | `HostMap` performs raw Mapbox fetches and contains user-facing inline English strings.                                                                      | Put Mapbox requests behind the approved feature API/server/provider boundary and localize all application-owned copy.                                |
| Authentication UX | Anonymous visitors can enter the wizard, but submission currently fails instead of deliberately handing off to authentication.                              | Let visitors complete the wizard, require login/signup at final submission, preserve the draft, and resume submission after authentication.          |
| Mutation UX       | Success returns to the market landing page; errors are generic and cache invalidation is not explicit.                                                      | On success invalidate affected event queries and open the created event; map stable error codes to localized, actionable messages.                   |
| Observability     | The request wrapper logs failures, but event creation has no explicit entry/success product instrumentation.                                                | Emit structured lifecycle logs and the `events_created` metric with non-sensitive market/city context.                                               |
| Verification      | Existing tests cover event reads and direct repository inserts, not the host create mutation. The only UI Playwright test is unrelated.                     | Add domain, Miniflare/D1, server-function, component, and critical-flow Playwright coverage.                                                         |

The staging walkthrough reached and exercised all three wizard steps. It did not submit an event because the audit was read-only and no disposable test identity/data authorization was in scope. A non-fatal opaque browser console error was observed from the map chunk and must be reproduced or ruled out during implementation.

### Browser UI/UX audit — 2026-08-31

The staging wizard was exercised in the built-in browser at desktop (1280px), tablet (768px), and mobile (390px) widths in Arabic RTL and French/English LTR. The audit covered city entry, venue search and selection, date/time selection, invalid time ranges, details validation, locale changes, login navigation and return, responsive layout, accessibility semantics exposed by the DOM, and console health. No event was submitted and precise-location permission was not granted.

| Severity | Confirmed issue                                                                                                                                                                                                | Required acceptance behavior                                                                                                                                                                  |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Blocker  | An anonymous visitor can enable `Publish`; final submission does not deliberately hand off to login/signup. The header login link omits the supported redirect parameter.                                      | Final submission opens login/signup with a validated return path, restores the draft at confirmation, obtains a fresh managed Turnstile response, and creates only with a valid session.      |
| Blocker  | Visiting login and returning reset the completed draft to step 1.                                                                                                                                              | Venue, schedule, details, capacity, language, and category survive the complete authentication round trip without user-authored content in the URL.                                           |
| Blocker  | The Adrar wizard accepted an out-of-city café and also accepted the `Adrar` locality itself as a venue.                                                                                                        | Search and server validation restrict results to the selected city and acceptable venue types; a city/locality result cannot be submitted as a café/coworking venue.                          |
| Blocker  | Capacity, event language, and category are absent from the UI and are silently hardcoded in the mutation.                                                                                                      | Each FR-E1 field is an explicit, validated host choice and is shown again at confirmation.                                                                                                    |
| Blocker  | The UI holds address and coordinates but submits only the venue name.                                                                                                                                          | The exact confirmed name, address, latitude, and longitude are persisted and displayed after creation.                                                                                        |
| Blocker  | The calendar is labeled/configured for Algeria while epochs use the browser timezone; no timezone is shown to the host.                                                                                        | The selected market timezone drives entry, conversion, validation, and the confirmation label independently of browser timezone.                                                              |
| High     | Switching locale reset the entire wizard. On mobile it retained the old scroll position and could leave the user looking at the footer.                                                                        | Switching among `ar`, `fr`, and `en` preserves the draft, active step, modal state where safe, and a useful scroll/focus position.                                                            |
| High     | Too-short title/description values disabled `Publish` without explaining the minimum or showing an inline error.                                                                                               | Required status, length rules, character counts, and localized field errors are visible and associated with the fields; the first invalid field receives focus.                               |
| High     | Next/Publish lives only in the page header. After editing on mobile, the enabled Publish button was above the viewport.                                                                                        | Mobile and tablet provide an always-reachable sticky action area without covering content; desktop retains a clear primary action.                                                            |
| High     | There is no complete final review. Stepper summaries truncate important schedule information on mobile.                                                                                                        | A dedicated confirmation state displays full venue/address, local date/time/timezone, duration, capacity, language, category, title, and description before authentication/submission.        |
| High     | The stepper exposes generic numbers/checks without step names, progress semantics, or `aria-current`; action controls precede step content in DOM reading order and step 2 lacks a meaningful section heading. | Step progress is semantically named, the current step is announced, reading/focus order follows the task, every step has a heading, and validation/status updates are announced.              |
| High     | Every tested map session emitted an opaque `Error` from the deployed `HostMap` chunk, although the map continued working.                                                                                      | The underlying failure is fixed or conclusively attributed, provider failures are logged with actionable context, and the UI has a localized recoverable error state.                         |
| High     | The map requests precise geolocation automatically on load before falling back to the selected city.                                                                                                           | Initial view uses the selected city; precise location is requested only after the host activates “Locate me” and permission denial has a non-blocking localized response.                     |
| High     | Dragging a selected marker changes coordinates while retaining the previous name/address.                                                                                                                      | Marker drag reverse-geocodes the new point and requires confirmation, or clearly invalidates the stale address until resolved.                                                                |
| High     | Map zoom/attribution labels and time-dialog accessibility labels remained English in French/Arabic. French geography names also fell back to English.                                                          | All application-controlled labels, dialogs, status announcements, geography display names, and errors are localized in `ar`, `fr`, and `en`; unavoidable provider attribution remains intact. |
| Medium   | Lazy map/search loading shows an unlabeled skeleton with no failure or retry path.                                                                                                                             | Loading is announced accessibly, provider timeout/failure offers retry, and a validated manual venue fallback is available only if it can meet the same data-integrity rules.                 |
| Medium   | The fixed 400px venue panel produces large empty space at tablet/mobile widths, followed by another 400px map and the full global footer.                                                                      | Compact responsive heights, reduced dead space, and a task-focused wizard footer keep the next action and relevant context close together.                                                    |

Positive evidence to preserve: the city empty state links to the correct city-scoped wizard; desktop, tablet, and mobile layouts had no horizontal overflow; Arabic set the document to RTL; most calendar/copy localization worked; past calendar days were disabled; the time dialog rejected an end before the start and supported keyboard arrow adjustment; fields had accessible label associations; and Mapbox attribution remained present.

The authenticated persistence/success path remains unverified until an approved disposable staging identity and test-event creation are available.

## 3. Locked implementation decisions

1. **One shared contract.** Move the create command schema to `libs/domain/src/events/schemas.ts` and infer all server and client input types from it. UI controls may use a client-step projection, but may not redefine the domain values.
2. **Canonical geography is server-owned.** The command identifies `marketCode` and `cityCode`; the server loads the visible market, verifies that its events feature is enabled, resolves the city within that market dataset, and derives `stateCode`. A client-supplied state is not authoritative.
3. **Free is invariant.** The server always persists `is_free = true`; the client does not submit a price or mutable free/paid flag.
4. **Capacity is explicit.** `0` continues to mean unlimited only if that convention remains in the domain and repository contract. The UI must present “Unlimited” as a deliberate choice rather than silently submitting zero. Positive capacities are integers within a documented maximum.
5. **Event language is authored metadata.** The host explicitly selects a value from the existing event-language schema. UI locale is only the interface language and must not silently determine event language.
6. **Categories come from the shared enum.** The wizard renders every currently supported category and submits the chosen value; it does not hardcode a default invisibly.
7. **Market timezone controls conversion.** Add reusable timezone conversion/formatting helpers to `libs/i18n` using platform `Intl` APIs. No timezone dependency is planned. The helper must handle DST gaps/overlaps deterministically and be tested for every configured market timezone.
8. **The database is the slug authority.** Add a composite unique index for `(market_code, slug)`. Generate a readable base slug and resolve conflicts through a bounded insert/retry path, or use an ID-derived suffix; never use a read-then-write uniqueness decision.
9. **External calls stay behind providers.** Mapbox geocoding/reverse-geocoding moves out of React components and behind a server-side map provider consumed by server functions. Turnstile verification uses a server-side provider/helper with a real production implementation and an explicit local/test implementation. Cloudflare bindings remain real Miniflare bindings in integration tests.
10. **Security fails closed outside local development.** A missing Mapbox or Turnstile production/staging secret/configuration is an operational failure, not an implicit bypass. Local bypasses must be explicit environment modes and cannot be accepted by deployed configurations.
11. **Authentication happens at the conversion boundary.** Anonymous visitors may complete the wizard. Final submission opens login/signup, preserves the draft safely, returns to the same market/city flow, obtains a fresh managed Turnstile response, and submits only after a valid session exists.
12. **Successful creation is immediately visible.** The server returns the canonical created event. The UI invalidates the market/city/host event queries and navigates to `/$market/e/$slug`.
13. **No new package or platform service.** If execution proves that `Intl`, current bindings, or existing providers are insufficient, implementation pauses for explicit approval before adding anything.

## 4. Work breakdown and sequence

The `EC-*` identifiers below are local work packages under the existing parent tickets. They do not replace the repository's P1 ticket IDs.

### EC-01 — Freeze the event-create contract

**Parent:** P1-005, P1-006
**Requirements:** FR-G2, FR-E1, FR-E2, FR-E9; NFR-9, NFR-10

**Status:** Complete — 2026-08-31

Work:

- Define the shared event-create Zod schema and inferred command type in `libs/domain`.
- Include market code, canonical city code, title, description, venue name, venue address, latitude, longitude, start/end instants, capacity, language, and category.
- Keep `hostId`, `stateCode`, `isFree`, event ID, slug, and audit timestamps server-owned.
- Add refinements for trimmed content, coordinate ranges, integer capacity, allowed enums, future start, end-after-start, and supported duration bounds.
- Export reusable field schemas/options for the wizard without introducing parallel client enums.
- Remove the local RPC schema and manual `as EventCreateInput` cast after consumers migrate.

Verification:

- Unit tests prove every accepted and rejected boundary, including unlimited capacity and each supported language/category.
- `nx run domain:test`, `nx run domain:typecheck`, and dependency-boundary lint pass.

Completion evidence:

- `libs/domain/src/events/schemas.ts` is the single event-create command contract and exports inferred types, field schemas, enum options, and bounds.
- The RPC validator consumes the shared schema directly; the handwritten RPC schema, resolver interface, manual cast, and client-owned `stateCode` were removed.
- The resolver derives canonical state from the market/city dataset and persists venue name, address, latitude, and longitude from the validated command.
- Boundary tests cover required fields, trimming, exact text/coordinate/capacity/duration limits, enums, future scheduling, server-owned-field rejection, and invalid numeric values.
- Real D1 integration verifies canonical state derivation and complete persistence. Repository-wide format, lint, typecheck, test, and build gates pass without E2E.

### EC-02 — Make time entry market-correct

**Parent:** P1-006
**Requirements:** FR-E1; NFR-8, NFR-9
**Status:** Complete — 2026-08-31

Work:

- Pass `market.timezone` from the route/market model into the host flow.
- Replace the hardcoded `Africa/Algiers` label and browser-local timestamp construction.
- Add `libs/i18n` helpers that convert a selected wall-clock date/time in an IANA zone to UTC and format it back for confirmation.
- Define deterministic validation for nonexistent and ambiguous local times. Nonexistent wall times are rejected; ambiguous times require a documented selection policy and a confirmation label containing the zone offset.
- Render a final localized schedule summary before submission.

Verification:

- Unit tests run with a host process timezone different from the market timezone.
- Cover DZ, EG, and SA configured timezones, a day boundary, and a DST transition in a zone that observes DST.
- Component tests verify localized timezone labels in both RTL and LTR.

Completion evidence:

- `libs/i18n/src/zoned-time.ts` resolves wall-clock values in an explicit IANA timezone without using the browser or process timezone. DST gaps fail validation, and DST overlaps deterministically select the earlier instant.
- The host picker receives `market.timezone`, uses timezone-aware calendar dates, converts both range boundaries through the shared helper, and advances the end calendar day for ranges that cross midnight.
- Step 3 renders the localized start and end schedule, each with its numeric UTC offset, plus the configured IANA timezone. Invalid wall-clock and timezone failures have localized `ar`, `fr`, and `en` messages.
- Tests cover all three configured market timezones, process-timezone independence, a year/day boundary, DST gaps and overlaps, localized numeric offsets, and RTL/LTR component output.
- Focused i18n and public-app tests, lint, and typecheck pass. Repository-wide non-E2E verification is recorded with the implementation handoff.

### EC-03 — Enforce event route-key integrity in D1

**Parent:** P1-005
**Requirements:** FR-G2, FR-E5, FR-E7; NFR-4, NFR-12

Work:

- Run read-only duplicate checks against local, staging, and production D1 before generating the migration.
- If deployed duplicates exist, stop and prepare a deterministic data-remediation proposal for approval before changing those rows.
- Add a Drizzle composite unique index on event `market_code` and `slug` and generate the corresponding reviewed D1 migration.
- Replace the resolver's read-before-write slug selection with database-enforced insert/retry or an ID-suffixed slug.
- Map exhausted collisions to a typed `AppError`, not a raw database error.
- Preserve forward-only migration behavior; do not edit an already-applied migration.

Verification:

- Apply migrations to a fresh Miniflare D1 database and to a database seeded at the prior schema version.
- Integration tests attempt concurrent same-title creation in one market and verify distinct canonical routes.
- Verify that the same readable slug may exist in different markets if that remains the intended route model.

### EC-04 — Complete venue selection and persistence

**Parent:** P1-006
**Requirements:** FR-G2, FR-E1; NFR-4, NFR-10

Work:

- Define a map provider contract around the already approved Mapbox integration.
- Add validated server functions for the minimum required city lookup/reverse-geocode operations and expose them only through the feature `api.ts` and hooks.
- Remove raw `fetch` calls from `HostMap` and prevent components from importing the provider/server function directly.
- Restrict/validate Mapbox results to the selected market/city as far as provider data reliably permits; always validate coordinate ranges server-side.
- Restrict selectable features to supported café/coworking venue types; reject locality/city results and out-of-city coordinates at both provider normalization and the create boundary.
- Persist `venueName`, `venueAddress`, `latitude`, and `longitude` in the create row.
- Start from the selected city. Request precise geolocation only after an explicit “Locate me” action and handle denial without blocking venue search.
- Reverse-geocode a dragged marker and require the normalized new address to be confirmed before progression; never retain a stale address after coordinates change.
- Retain Mapbox attribution and keyboard-accessible zoom/selection behavior.
- Reproduce the opaque staging `HostMap` console error across search, selection, locale change, and remount; fix it if application-owned, or document conclusive third-party evidence and suppress no actionable application failure.
- Add accessible loading, timeout, error, and retry states for map/search initialization.

Verification:

- Provider unit tests cover response normalization and failure mapping.
- Server integration tests use the provider's explicit local/test implementation while retaining real D1 and Durable Object bindings.
- Component tests prove search selection and map-click selection populate the same normalized venue model.
- Component/provider tests reject out-of-city and non-venue results, verify explicit-only geolocation, and prove marker drag refreshes or invalidates the address.
- Inspect the persisted D1 row after a staging creation and compare it with the selected venue.

### EC-05 — Harden the create server pipeline

**Parent:** P1-005, P1-018
**Requirements:** FR-G2, FR-G3, FR-E1, FR-E2; NFR-4, NFR-7, NFR-10

Work:

- Keep the order component -> hook -> feature API -> server function -> domain -> repository -> D1.
- Validate with the shared schema through `appValidator`.
- Require the centralized create-event permission and an authenticated session.
- Load the market from D1, allow only `open`/`active` markets with events enabled, and reject unknown/dark markets.
- Resolve the city from the versioned market geography and derive `stateCode`; reject mismatched or unknown geography.
- Run pure event invariants in `libs/domain`, return `Result`, and unwrap only via `handleResult()` in the server handler.
- Persist all canonical fields and return the created event DTO.
- Ensure raw provider, Drizzle, and unexpected errors are converted at the server boundary without leaking internals.

Verification:

- Miniflare integration tests cover unauthenticated, unauthorized, dark market, disabled feature, invalid city, invalid schedule, invalid coordinates, success, and repository/provider failure.
- Tests assert that host ID, state code, `isFree`, ID, slug, and timestamps cannot be forged by the client.

### EC-06 — Add complete anti-abuse protection

**Parent:** P1-018
**Requirements:** NFR-4

Work:

- Run Turnstile in managed/non-interactive mode at the final create step and send a single-use response with the mutation. It must not add another visible challenge after login/signup unless Cloudflare determines interaction is necessary.
- Add reusable server-side verification at the server-function boundary, forwarding `CF-Connecting-IP` as `remoteip`.
- Reset/reissue the widget response after verification failure, mutation failure, expiry, or retry.
- Retain the identity-scoped Durable Object token bucket and verify that create-event has its own explicit policy.
- Confirm middleware ordering avoids expensive provider work before authentication/abuse checks while still returning stable typed errors.
- Define the corresponding Cloudflare WAF rate-limit rule and record account-side configuration evidence for staging and production.
- Verify that deployed configurations fail closed when the Turnstile secret or WAF prerequisite is absent.

Verification:

- Integration tests cover valid, missing, invalid, expired, replayed, and provider-unavailable Turnstile responses plus DO rate-limit exhaustion.
- Confirm the remote IP is forwarded without logging the token or full IP as product telemetry.
- Staging tests verify WAF and application limits independently using a safe low-volume procedure.

### EC-07 — Finish the authenticated, localized wizard

**Parent:** P1-006
**Requirements:** FR-E1, FR-E9; NFR-8, NFR-9

Work:

- Allow anonymous visitors to complete the wizard, then intercept final submission and send them through login/signup with a validated same-origin return path containing market/city context.
- Preserve the draft across the authentication round trip without placing sensitive or user-authored form content in the URL. After authentication, restore the confirmation step, obtain a fresh Turnstile response, and require the user to confirm submission.
- Preserve the complete draft and active step across `ar`/`fr`/`en` locale changes, and restore a useful focus/scroll position instead of retaining a stale page offset.
- Add explicit capacity, event-language, and category controls sourced from the shared schema.
- Preserve venue address/coordinates and timezone-aware schedule through all steps and back navigation.
- Validate each step using the relevant projection of the shared schema; show required status, constraints, character counts, and localized inline errors; focus the first invalid field.
- Add a dedicated confirmation state that shows the full venue/address, localized date/time/timezone, duration, capacity, language, category, title, and description without truncating essential values.
- Move every application-owned string in `HostCreatePage`, `HostMap`, `VenueSearch`, `TimePicker`, stepper/status announcements, geography display, and related loading/error states into `libs/i18n` resources for `ar`, `fr`, and `en`.
- Give the stepper semantic step names, progress/current-step state, and announced updates. Give every step a heading and order DOM/focus traversal by the task rather than placing Next/Publish before the fields it validates.
- Add a sticky mobile/tablet action area for Back and Next/Publish, with safe-area handling and no content obstruction. Keep the desktop action visually prominent.
- Replace fixed-height empty panels and the full transactional footer with a compact responsive composition that keeps the current task and its action close together.
- Use logical spacing and verify control order, focus order, map controls, time-dialog labels, modal behavior, and live validation under RTL and LTR.
- Prevent duplicate submission and make in-flight state visible.

Verification:

- Component tests exercise all steps, anonymous final-submit authentication handoff, post-auth draft restoration, locale-change preservation, back/forward state retention, validation messages/focus, unlimited/limited capacity, each language/category, confirmation, sticky actions, submission lock, and Turnstile reset.
- Accessibility checks cover semantic progress, headings, DOM/reading order, labels, names, keyboard operation, focus, modal labels, and error/status announcements.
- Render checks cover Arabic RTL and French/English LTR at 390px mobile, 768px tablet, and 1280px desktop widths with no horizontal overflow or truncated essential summary.

### EC-08 — Complete success, failure, and cache behavior

**Parent:** P1-006, P1-019
**Requirements:** FR-E5, FR-E7; NFR-7, NFR-9

Work:

- Map `appErrorCode()` values to localized, actionable messages and retain entered values on recoverable failures.
- Treat authentication expiry specially: preserve safe form state, re-authenticate, and require a fresh Turnstile response.
- On success, invalidate the affected market, city, event-detail, and host-profile query keys.
- Navigate to the returned canonical event route and render the new event without a manual refresh.
- Add structured entry, success, and failure logs with request, market, city, and host identifiers according to the observability redaction policy.
- Emit the `events_created` Analytics Engine metric only after durable persistence succeeds.
- Do not emit provider tokens, full form content, venue free text, or descriptions to logs/metrics.

Verification:

- Tests assert cache invalidation/navigation and error-code mappings in all locales.
- Integration tests assert success metrics are emitted once and never on rejected or failed writes.
- Staging logs correlate one create request across the server path without exposing secrets or user-authored content.

### EC-09 — Build the real-platform regression suite

**Parent:** P1-021
**Requirements:** NFR-4, NFR-8, NFR-9, NFR-11, NFR-12

Work:

- Add domain tests for create schema/invariants and timezone conversion.
- Add D1 repository tests for complete venue persistence and atomic slug uniqueness.
- Add server-function integration tests against Miniflare D1 and Durable Objects. Do not mock Cloudflare bindings.
- Add UI component tests for the complete wizard, locale/draft preservation, responsive actions, semantic progress, map loading/error states, and localized field/dialog errors.
- Add a Playwright flow that completes the wizard anonymously, switches locale without losing progress, enters login/signup from final submission, restores the confirmation draft, authenticates a disposable host, creates the event, lands on its detail page, finds it on the city feed and host profile, and verifies the stored schedule/venue/capacity/language/category.
- Run the browser flow at 390px mobile, 768px tablet, and 1280px desktop widths; include Arabic RTL and French/English LTR coverage, assert that primary actions remain reachable, and fail on application-owned `pageerror`/unexpected console errors.
- Add focused browser assertions for inline validation messages, untruncated confirmation content, explicit-only geolocation, map provider recovery, and safe behavior when a venue result is outside the selected city or is not a supported venue type.
- Make Playwright data unique and self-identifying. Cleanup must be explicit and safe; if cleanup is unavailable, use a dedicated disposable local database.
- Keep this E2E target outside GitHub Actions until the existing “skip E2E” decision is changed. Document the local/staging command and retain its result as release evidence.

Verification gate:

```text
npx nx run domain:test
npx nx run db:test
npx nx run server-fns:test
npx nx run ui:test
npx nx run-many -t typecheck lint build
npm run format:check
npx nx run ui:e2e -- --grep "create event"
```

The final command is a local/staging release check, not a CI job under the current policy.

### EC-10 — Stage, verify, and release

**Parent:** P1-006, P1-018, P1-019, P1-021
**Requirements:** NFR-4, NFR-7, NFR-12

Work:

- Confirm staging has the Mapbox and Turnstile secrets, D1/DO/Analytics bindings, and WAF rule before deployment.
- Apply the D1 migration to staging, deploy the Worker, and run the critical Playwright flow with an authorized disposable account.
- Inspect the created event in the UI and D1, confirm the city feed and public host profile, and verify logs/metrics.
- Test from a browser timezone different from the market timezone and in all three locales.
- Record the migration ID, Worker deployment version, WAF rule identifier, test event ID, and test result in the deployment evidence location used by the repository.
- Repeat the configuration preflight for production, apply the migration before the compatible Worker deployment, and perform one authorized smoke creation.
- Close P1-006 only when the credential, feature API, localization, persistence, and route behavior are verified. Update P1-018/P1-019/P1-021 only for the evidence actually completed.

Rollback:

- Roll back the Worker deployment if the create path regresses; keep the backward-compatible unique index in place.
- Disable event creation through the existing events feature flag if data integrity or abuse protection is uncertain.
- Do not reverse an applied D1 migration destructively. Ship a reviewed forward migration if schema correction is required.
- Preserve failed request correlation IDs and deployment evidence for diagnosis.

## 5. Required test matrix

| Layer              | Required cases                                                                                                                                                                                                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain             | Field bounds; trimming; schedule ordering; future start; duration; capacity; language/category enums; coordinate ranges; `isFree` invariant                                                                                                                                                        |
| i18n/time          | Browser zone differs from market; day rollover; DST gap/overlap; ar/fr/en rendering; RTL/LTR                                                                                                                                                                                                       |
| Repository/D1      | Every venue field persists; composite uniqueness; concurrent same-title inserts; same slug across different markets; typed conflict handling                                                                                                                                                       |
| Server function    | Authn; authz; market state/flag; city derivation; forged fields; Turnstile; DO limit; success; provider failure; D1 failure; typed error serialization                                                                                                                                             |
| Component          | Final-submit auth handoff; auth/locale draft restoration; step validation and messages; back/forward retention; semantic progress; sticky actions; loading/retry; explicit geolocation; marker address refresh; localized controls/dialogs; duplicate submit; Turnstile refresh; full confirmation |
| Playwright         | Anonymous wizard -> locale switch -> login/signup -> restored confirmation -> create -> detail -> city feed -> host profile; persisted field equality; non-market browser timezone; 390/768/1280 widths; RTL/LTR; reachable actions; no unexpected application console errors                      |
| Staging operations | Secrets/bindings; WAF; D1 migration; logs; metric; canonical URL; no sensitive telemetry; map console health                                                                                                                                                                                       |

## 6. Delivery boundaries

Implementation should be split by mission so each change remains reviewable and maps to the parent tickets:

1. `refactor(events): centralize the event creation contract` — EC-01 and EC-02.
2. `fix(events): enforce atomic event persistence` — EC-03 and its migration/tests.
3. `refactor(events): move venue lookup behind the feature boundary` — EC-04.
4. `fix(events): harden event creation authorization and validation` — EC-05 and EC-06, split again if the security diff is not small.
5. `feat(events): complete the localized host wizard` — EC-07 and EC-08.
6. `test(events): cover the complete event creation flow` — EC-09.
7. Account-side configuration and deployment evidence are operational work under EC-10 and must not be represented as code-complete before verification.

Do not combine the D1 migration, map-provider refactor, full wizard redesign, and WAF operation into one pull request.

## 7. Risks and execution-time approvals

| Risk or dependency                                                          | Response                                                                                                                 |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Existing duplicate slugs make the unique-index migration fail.              | Run read-only preflight first. Any deployed data rewrite requires explicit approval and a reviewed mapping.              |
| Staging/production testing creates durable user-visible data.               | Obtain approval for a disposable test identity and test-event creation/cleanup before the staged smoke test.             |
| WAF is account-side and cannot be proven from repository code alone.        | Capture rule ID/configuration and a safe behavioral verification for each environment.                                   |
| Mapbox/Turnstile provider behavior is unavailable locally.                  | Use explicit provider development/test variants; keep D1/DO bindings real. Do not silently bypass deployed verification. |
| Timezone ambiguity produces a different UTC instant than the host intended. | Reject nonexistent times and surface zone/offset in confirmation; lock the ambiguous-time policy with tests.             |
| E2E is intentionally absent from CI.                                        | Require it locally and on staging for release. Re-adding it to CI is a separate explicit decision.                       |
| A proposed fix requires a new package, binding, or vendor.                  | Stop and request approval before changing dependencies or infrastructure scope.                                          |

## 8. Definition of done

- [ ] Every FR-E1 field is explicitly collected, validated from one schema, and persisted.
- [ ] Venue address and coordinates survive creation and render correctly; out-of-city/locality results are rejected and marker drag cannot retain a stale address.
- [ ] Market timezone, not browser timezone, determines the stored UTC instants.
- [ ] The server derives canonical geography and rejects dark/disabled/cross-market creation.
- [ ] Event route slugs are protected by a D1 unique constraint and race-safe insertion.
- [ ] Authentication, centralized permission, Turnstile, DO rate limit, and WAF all protect creation.
- [ ] Anonymous final submission performs login/signup handoff and restores the complete draft; locale changes also preserve step, draft, focus, and useful scroll position.
- [ ] All application-owned copy, map controls, time-dialog labels, statuses, validation, and geography display names exist in `ar`, `fr`, and `en`; RTL/LTR and WCAG 2.1 AA checks pass.
- [ ] Semantic step progress, headings, reading/focus order, inline validation, accessible loading/retry, and error announcements are verified.
- [ ] Back/Next/Publish remains reachable at mobile, tablet, and desktop widths; the final confirmation shows every essential value without truncation.
- [ ] Precise location is requested only by explicit user action, map/provider failures recover visibly, and the create flow produces no unexplained application console errors.
- [ ] Success opens the created event and updates city and host event views without a refresh.
- [ ] Typed errors, structured logs, request correlation, and `events_created` metrics are verified without sensitive leakage.
- [ ] Domain, D1/Miniflare, server-function, component, formatting, lint, boundary, typecheck, and build gates pass.
- [ ] The critical Playwright create flow passes locally and on staging, while remaining outside CI under the current decision.
- [ ] Staging and production migrations, secrets/bindings, WAF, deployment versions, and smoke evidence are recorded.
- [ ] `docs/implementation-plan.md` and `docs/events-system-plan.md` are updated to match verified operational reality after implementation—not before.
