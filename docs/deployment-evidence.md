# Deployment evidence

This file records account-side facts that repository code and CI cannot prove. Do not mark a gate
complete from configuration intent alone. Never record secrets, Turnstile responses, full IP
addresses, session cookies, or personal test-account data.

## EC-06 event-create anti-abuse

| Check                           | Staging                                                                                                      | Production                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| WAF rule definition             | Shared Free-plan definition in `libs/infra/cloudflare/waf/free-shared-mutation-rate-limit-rule.json`         | Same zone-wide definition                                                                   |
| WAF rule ID                     | `d11c283bee39488293e86d519e9c546d`                                                                           | `d11c283bee39488293e86d519e9c546d`                                                          |
| Rule behavior                   | Verified on 2026-09-02: responses `403, 403, 403, 403, 403, 429` at a temporary five-request probe threshold | Configuration verified; behavioral probe blocked because the apex hostname does not resolve |
| Turnstile widget/secret pairing | Not externally verified                                                                                      | Not externally verified                                                                     |
| Worker evidence marker          | Uploaded as `true` on 2026-09-02                                                                             | Uploaded as `true` on 2026-09-02                                                            |

### 2026-09-02 Free-plan activation

A dedicated user API token was verified as active and successfully read the `founders.coffee` zone
and its `http_ratelimit` ruleset. The zone is on the Free Website plan. Its one available
rate-limiting-rule slot is occupied by the existing “Leaked credential check” rule. Creating the
committed staging rule returned Cloudflare error `50001`, “exceeded the maximum number of rules,” so
no rule was created or changed.

The Founder subsequently chose full Free-plan compatibility for staging and production. Because the
product is passwordless, the leaked-password rule was replaced in place with one zone-wide rule that
covers `/api/auth/` and `/_serverFn/`. The rule counts by edge colo and source IP, allows 20 requests
per 10 seconds, and blocks for 10 seconds. A single rule covers both environments and stays within
the Free plan's one-rule, path-only, 10-second limits.

The staging behavioral test temporarily narrowed the expression to the unique nonexistent path
`/_serverFn/ec06-waf-free-plan-probe` and reduced the threshold to five requests. The first five
requests reached the Worker and returned its normal `403`; the sixth returned WAF `429`. The final
committed expression and 20-request threshold were restored and read back from Rulesets API version
4 before both Worker evidence markers were uploaded. Production uses the same active zone rule, but
its independent behavioral check remains pending because `founders.coffee` had no resolvable DNS
record from the verification environment.

## EC-10 release verification — staging

Recorded 2026-09-03. This is the handoff trace the community-operations plan requires before CO-01
starts. It covers the event-creation slice only: the events below were created by the release gate
and deleted immediately, and none of them is a post-event attendance or feedback fixture.

| Field              | Value                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| Environment        | staging, `founders-coffee-ui-staging`, `https://staging.founders.coffee`                            |
| Commit deployed    | `d29ce6a`                                                                                           |
| Worker version     | `9a132a7a-72cb-40c1-841c-e357e4476fcf`, deployed 18:42 UTC by the Deploy workflow                   |
| D1 migration state | `founders-coffee-db-staging` current through `0016_light_alex_wilder.sql`; "No migrations to apply" |
| Bindings present   | `DB`, `EVENT_LIVE`, `RATE_LIMITER`, `ANALYTICS`                                                     |
| WAF rule           | `d11c283bee39488293e86d519e9c546d`, enabled, 20 requests per 10s on `/_serverFn/` and `/api/auth/`  |
| Turnstile at run   | Cloudflare testing keys, applied 20:07 UTC and reverted 20:11 UTC — see the note below              |
| Canonical route    | `/{market}/e/{slug}`, reached by the wizard's own post-publish navigation                           |

Playwright, run one project at a time against the deployed Worker with `E2E_D1_MODE=remote` and
`E2E_SERVER_LOG` fed by `wrangler tail --env staging --format json`. **18 of 18 passed.**

| Project      | Viewport | Locale | Result | Event created                          |
| ------------ | -------- | ------ | ------ | -------------------------------------- |
| `mobile-ar`  | 390×844  | ar     | 6/6    | `evt_98b3072840df47639d210335f0dbf138` |
| `tablet-fr`  | 768×1024 | fr     | 6/6    | `evt_f955b2c781e146ffaf6593cd4b20432e` |
| `desktop-en` | 1280×800 | en     | 6/6    | `evt_ecb60b3ce00549d1983b8681346c15dd` |

All three were market `DZ`, city `556`, state `16`, category `workshop`, capacity 24, in the
locale of their project. Each host was a disposable identity in the reserved `@e2e.invalid` domain,
created by the run and deleted by it.

Telemetry read from the Worker's own structured logs: every creation was preceded by
`event_create_requested` and followed by `event_create_succeeded` on the same `requestId`, carrying
only the allow-list projection — host, market, city, category, language, capacity, duration. No
title, description, venue or address appeared in any log line. No `events_created_metric_unavailable`
was emitted in any run, so the `ANALYTICS` binding resolved and `writeDataPoint` did not throw.

Cleanup verified by query after all three runs: `0` events, `0` users, `0` RSVPs, `0` verification
rows for the reserved domain.

**Turnstile note.** Event creation carries no challenge as of `826691b`. Sign-in still does, and no
automated browser clears it in any widget mode, so the gate cannot authenticate unaided. Cloudflare's
testing keys were set on staging for the four minutes the runs took and the real widget restored
immediately afterwards, its secret read back from the Turnstile API rather than retyped. While those
keys are set, staging sign-in and the waitlist have no bot protection; any future staged run needs
the same deliberate, short window. `OTP_ECHO` was likewise set for the runs and has been removed from
the committed staging vars.

~~**Not yet done.** Production preflight, migration, deployment, the WAF behavioral probe, and the
authorized smoke creation are all outstanding, and all of them are blocked on the same thing: the
apex `founders.coffee` has no resolvable DNS record.~~ The DNS record was never a prerequisite —
see the production section below.

## First production release — v0.1.0, 2026-09-04

Deployed by the pipeline, from `main`, at commit `134cc73`. `Verify` (7m06s) → `Migrate and deploy`
(1m43s) → `Tag and release` (12s), GitHub Actions run `33852712763`.

| Worker                                   | Version                                |
| ---------------------------------------- | -------------------------------------- |
| `founders-coffee-ui-production`          | `87132e77-9b88-4274-b4e2-a4dd510c514b` |
| `founders-coffee-admin-production`       | `cddc1b0f-1023-4d39-a275-7a743ed82841` |
| `founders-coffee-dashboard-production`   | `e7cb2bf9-f4b0-49ed-b778-c2923131877c` |
| `founders-coffee-worker-jobs-production` | `6978aafa-f7d5-4176-85e7-27e1b7a27577` |

Tag `v0.1.0`, release published from 218 conventional commits.

### The DNS record was an output, not a prerequisite

Every earlier note in this file treated the missing apex record as the blocker. It was not.
`apps/ui/wrangler.jsonc` declares `routes: [{ pattern: "founders.coffee", custom_domain: true }]`,
and a Workers custom domain **creates its own DNS record** on deploy. The apex held only `MX` and
`TXT` records, which do not conflict with an `AAAA`, so the deploy provisioned it unattended. Three
custom domains were created by this run:

| Hostname                | Worker                                 |
| ----------------------- | -------------------------------------- |
| `founders.coffee`       | `founders-coffee-ui-production`        |
| `admin.founders.coffee` | `founders-coffee-admin-production`     |
| `app.founders.coffee`   | `founders-coffee-dashboard-production` |

All three are the `AAAA … 100:: proxied` shape Cloudflare uses for Worker custom domains, matching
the three staging hosts.

### Verified after deploy

**Migrations** current through `0016_light_alex_wilder.sql`, the same head as staging. Production D1
`7685fda1-7bc0-4907-a37a-a77e8daa5ecb` holds `0` events, `0` users and the `3` seeded markets.

**Routes.** `/` answers `307` to `/algeria` (geo-redirect); `/algeria`, `/algeria/host/create`,
`/login`, `/about`, `/contact`, `/privacy`, `/terms` and `/cookies` all `200`; an unknown event slug
`404`s. Response times 0.36–0.59s.

**Headers.** `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`,
`X-Frame-Options`, `Permissions-Policy` all enforced. The CSP is still `report-only`
(`CSP_ENFORCED` is unset).

**WAF behavioral probe — the rule is live.** The shared zone rate-limit rule
`d11c283bee39488293e86d519e9c546d` (20 requests / 10s per `ip.src` + `cf.colo.id` on `/_serverFn/`
and `/api/auth/`) was probed against `/api/auth/get-session`, a read-only endpoint that sends
nothing:

| Burst                          | Result                    |
| ------------------------------ | ------------------------- |
| 26 sequential requests         | 26 × `200`                |
| 40 parallel requests, 0.72s    | 39 × `200`, 1 × `429`     |
| 30 parallel, immediately after | 1 × `200`, **29 × `429`** |
| 30 parallel, after mitigation  | 30 × `200`                |

Sequential requests never trip it — curl's own startup spreads them past the window, which is worth
knowing before anyone concludes from a slow loop that the rule is off. Under a real burst the
mitigation engages and then expires on schedule.

**Admin is not exposed.** `admin.founders.coffee` answers `403`
`{"error":"Missing Cf-Access-Jwt-Assertion"}` — the Worker fails closed without a Cloudflare Access
JWT, even though Access itself is not yet configured in front of it.

**`app.founders.coffee` is publicly reachable and serves the dashboard shell** (`200`, title
"founders.coffee · Dashboard"). The dashboard is the future sponsor portal and is explicitly outside
the current release. Its custom domain was created as a side effect of deploying all four Workers
together. Removing that route is a one-line change to `apps/dashboard/wrangler.jsonc`.

## v0.2.0 — enforced CSP, queues bound, sponsor portal unpublished (2026-09-04)

GitHub Actions run `33859453677` from `main` at `9ce6b1c`. Verify 6m43s, migrate and deploy 1m43s,
tag and release 19s.

**The CSP is enforced in both environments.** `https://founders.coffee` and
`https://staging.founders.coffee` now answer with `content-security-policy` rather than
`content-security-policy-report-only`. Staging was enforced and verified first, because report-only
and enforced are not the same test.

Measured on enforced production, in `ar`:

| Check                                       | Result                                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Violations, 4 routes × 3 locales            | 0                                                                                                        |
| `/algeria/host/create` Mapbox canvas        | 710×358, 1 map container, 0 console errors                                                               |
| Self-hosted `mapbox-gl-csp-worker` requests | 2                                                                                                        |
| `mapbox-gl-rtl-text` requests               | 3 (main thread + both workers)                                                                           |
| `/login` Turnstile                          | widget iframe mounted, `cf-turnstile-response` input present, 13 requests to `challenges.cloudflare.com` |
| Cloudflare Web Analytics beacon             | still loads (1 request per page) under enforcement                                                       |

The last row is the one that settles AR-08's old blocker: the beacon loads while the policy is
actively blocking, because Cloudflare's rewriter stamps our per-request nonce on it. Nothing had to
be turned off account-side.

`apps/admin` stays on report-only. It answers `403` without an Access JWT, so it cannot be loaded and
measured.

**Queues provisioned and bound.** Eight queues — notifications, embeddings-jobs and reconcile plus a
dead-letter queue, in each environment. Consumers are attached to
`founders-coffee-worker-jobs-{staging,production}` with `max_retries: 5` and the environment's DLQ.

Proven end to end on staging rather than assumed: a message posted to
`founders-coffee-reconcile-staging` through the Queues API produced this in `wrangler tail` —

```json
{ "outcome": "ok", "scriptName": "founders-coffee-worker-jobs-staging", "event": { "batchSize": 1, "queue": "founders-coffee-reconcile-staging" }, "logs": [{ "message": ["{\"count\":0,\"msg\":\"reconcile.pending_backlog\"}"] }] }
```

— the environment-suffixed name resolved to its catalogue name, the consumer ran, and the message
was acked. Nothing produced into these queues at the time; CO-02 (2026-09-10) added the producer —
a per-event `NotificationScheduleDO` alarm — but it is not deployed, so the account still shows zero
producers on both notifications queues. Re-read 2026-09-10: all eight queues present in both
environments, one consumer each, both DLQs correctly with none.

**The sponsor portal is unpublished.** `app.founders.coffee`'s custom domain
(`1d629406ba19fc525a1c26448571667a83e5685b`) was deleted and its DNS record went with it; the zone
now returns no record for that name. Note that removing the route from `wrangler.jsonc` does **not**
delete an existing custom domain — Cloudflare keeps it until it is deleted explicitly, so the config
change and the account action are two separate steps.

## v0.3.0 — the Round Table redesign (2026-09-04)

GitHub Actions run `33875681639` from `main` at `5525e30`. Verify 6m39s, migrate and deploy 1m45s,
tag and release 11s. `founders-coffee-ui-production` version
`fbd85a4c-57bb-4bfc-8e7e-04c2ba114d92`.

Eight commits: the Claude Design handoff in three stages, the `AppError.code` serialization fix, the
host-wizard dead end, and the audit.

**Verified on production, under the enforced CSP:**

| Check                              | `ar` 390  | `en` 1280 | wizard 1280           |
| ---------------------------------- | --------- | --------- | --------------------- |
| `securitypolicyviolation` events   | 0         | 0         | 0                     |
| Console / page errors              | 0         | 0         | 0                     |
| Outfit + Tajawal loaded            | yes       | yes       | yes                   |
| Body background                    | `#FFFCF7` | `#FFFCF7` | `#FFFCF7`             |
| Mapbox canvas, tiles, venue search | —         | —         | drawn, `200`, enabled |

The redesign adds no external resource, so the enforced policy needed no change: the fonts are
self-hosted through `@fontsource`, the mark is inline SVG, and the only new outbound reference is an
"Open in maps" **link**, which a policy does not govern.

Route latency 1.6–2.3s. One 78s outlier on the first `/login` hit immediately after deploy — a cold
start, not reproducible across three retries.

## EC-10 authorized production smoke creation — 2026-09-10

The last outstanding EC-10 item. Performed by the owner by hand against the live site, with **no
change to production configuration**: no Turnstile testing-key window, no `OTP_ECHO`, no bypass of
any kind. Turnstile stayed enforced and a person cleared it, which is the only way that challenge is
meant to be cleared. The sign-in code went to the owner's own address, because the `@e2e.invalid`
echo used on staging is fenced off when `APP_ENVIRONMENT` is `production`.

| Fact               | Value                                       |
| ------------------ | ------------------------------------------- |
| Event              | `dsrwrtwerwer` at `/algeria/e/dsrwrtwerwer` |
| Market / city      | `DZ` / Chlef                                |
| Schedule           | Wednesday 16 September 2026, 18:00          |
| Venue as persisted | `fgtfrtryr — Site 5، 02 الشلف، الجزائر`     |
| Language           | `ar`                                        |
| Host               | `19hkEveIHJogeBQ4fZLSlJqYByifH2pM`          |
| Worker             | `v0.1.0`, released 2026-09-04               |
| D1 schema          | `0016_light_alex_wilder`                    |
| Shared WAF rule    | `d11c283bee39488293e86d519e9c546d`          |

**Route behaviour, read back from the live site rather than asserted:**

| Surface                         | Result                                                                   |
| ------------------------------- | ------------------------------------------------------------------------ |
| Event detail                    | `200`, correct title, JSON-LD `@type: Event` with the persisted schedule |
| City feed `/algeria/chlef`      | `200`, event listed                                                      |
| Market page `/algeria`          | `200`, event listed, Chlef badge showing one this week                   |
| Public host profile `/u/<host>` | `200`, "فعاليات نظمها 1"                                                 |
| Host auto-RSVP                  | `+1 ذاهب` — the host is a real attendee on creation                      |
| RSVP release                    | seats 11 → 12 and `+1` → `+0` after the host freed their chair           |

The live page also rendered `السعة: 12`, `مقاعد متبقية` and the `مجاني` chip — capacity, seats and
the free label — which independently confirms production is at `0016` and predates the `0017`
contraction, without needing a schema query.

**Verification method note.** Plain `curl` receives `403 Forbidden` on every production route,
including `/`. That is the CSRF middleware refusing a request with no `Sec-Fetch-Site` header, not an
outage: `none` and `same-origin` both pass and browsers always send one. Any future automated
production probe must set that header.

**Cleanup — done 2026-09-10.** The event was retired rather than deleted, so the row survives as
this evidence. Retiring it through the product is not possible on `v0.1.0`: the host cancel action,
the optional reason and `0018_graceful_maria_hill.sql` are all in unreleased work, and the live
event page offers only the RSVP controls. The owner released their seat first, which is why the
counts above return to `12` and `+0`.

The status was therefore set with one statement guarded on slug, market and current status, so it
could affect exactly one row and is a no-op if repeated:

```sql
UPDATE events SET status='cancelled', cancelled_at=unixepoch(), updated_at=unixepoch()
WHERE slug='dsrwrtwerwer' AND market_code='DZ' AND status='published';
```

`changes: 1`. Read back from production:

| Column                      | Value               |
| --------------------------- | ------------------- |
| `status`                    | `cancelled`         |
| `cancelled_at`              | 2026-09-10 07:25:01 |
| `market_code` / `city_code` | `DZ` / `39`         |
| `language`                  | `ar`                |
| `rsvps`                     | `0`                 |
| `starts_at`                 | 2026-09-16 17:00:00 |

The row confirms what the pages showed: the persisted city is Chlef (`39`), the language is the one
chosen in the wizard, and the RSVP counter returned to zero when the seat was released.

**The feeds dropped it; the direct URL did not.** `/algeria`, `/algeria/chlef` and the public host
profile no longer carry the event, because each filters on `status = 'published'`. The event's own
URL still renders it as though it were live, RSVP call to action included, since `v0.1.0` has no
cancelled state in `EventDetail`. Nobody can reach it without the link, and the unreleased work
fixes it directly — the current `EventDetail` renders a cancellation notice for exactly this status.

**Outstanding on this item:** none.

## ND-01 — service worker and FCM credentials on staging, 2026-09-10

| Item                                                 | Value                                                                                                                                           |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `founders-coffee-ui-staging` version                 | `8d7d99f8-254b-41c4-986f-21f0489f5b78`                                                                                                          |
| `founders-coffee-worker-jobs-staging` version        | `94464116-fa8c-4584-966b-bf0785146b44`                                                                                                          |
| `https://staging.founders.coffee/sw.js`              | 200, `text/javascript`, `max-age=0, must-revalidate`, 40977 bytes                                                                               |
| Served worker vs local build                         | byte-identical (`cmp`)                                                                                                                          |
| Precache                                             | 52 entries, 1290.25 KiB (was 5.5 MB before Mapbox was excluded)                                                                                 |
| Firebase secrets, `ui` staging + production          | `FIREBASE_API_KEY`, `FIREBASE_APP_ID`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_PROJECT_ID`, `FIREBASE_VAPID_KEY`                              |
| Firebase secrets, `worker-jobs` staging + production | `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT`                                                                                               |
| Project coherence                                    | the sender id inside `FIREBASE_APP_ID` matches `FIREBASE_MESSAGING_SENDER_ID`; `FIREBASE_PROJECT_ID` matches the service account's `project_id` |

The URL that was 404 for the life of the feature now serves the worker. **Nothing beyond that is
proven**: registration, token minting and delivery all need a browser, and the Chrome extension was
not connected for this session. ND-02 remains open.

### ND-02 — push delivered end to end on staging, 2026-09-10

The first push notification this product has ever delivered. Driven through the real UI on
`staging.founders.coffee`, signed in, against real FCM.

| Step                                     | Evidence                                                                                                                                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service worker                           | `scriptURL https://staging.founders.coffee/sw.js`, `state activated`, scope `/`, controlling the page                                                                                    |
| Firebase config from the deployed Worker | `getFirebaseConfig` returned `apiKey`, `authDomain`, `projectId`, `messagingSenderId`, `appId`, `vapidKey`                                                                               |
| Permission and subscription              | `Notification.permission granted`; `pushManager` subscription endpoint on `fcm.googleapis.com`                                                                                           |
| Device registration                      | one row in `push_subscriptions`; `account_preferences.push_enabled = 1`                                                                                                                  |
| Enqueue                                  | `rsvp_confirmation`, `reminder_72h`, `reminder_24h`, all `channel = push`                                                                                                                |
| Delivery                                 | `ntf_51d072be08d64f48b1769193123e73e2` → `status sent`, `attempts 0`, **7 seconds** from RSVP                                                                                            |
| Rendered notification                    | title `أنت ذاهب إلى React patterns workshop`, body `سنذكّرك قبل البداية.`, icon `/android-chrome-192x192.png`, tag = the notification id, `data.url = /algeria/e/react-workshop-algiers` |

Each of the four payload defects is disproved by that last row: FCM accepted the message (the token
exchange), the title rendered rather than `undefined` (data-only envelope read by `readPushPayload`),
the click target is the event and not `/` (`pushUrl` now travels), and the icon path resolves.

The refusal before a device existed was also correct: an earlier confirmation failed with
`unreachable: push_not_enabled` and wrote no fallback, because the member had neither a live device
nor a consented number.

**Open:** the notification rendered in Arabic while the browser was in English. `locale_pref` is null,
so `resolveNotificationContext` falls back to the market default rather than the device cookie. By
design — the server cannot see a device cookie — but a member reading English gets notified in Arabic.

### ND-02 fallback half — push failure lands on email, 2026-09-10

Run on staging after ND-07, by deleting the member's `push_subscriptions` row so push fails the way
a signed-out device does, then re-RSVPing.

| Step               | Evidence                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------- |
| Primary refused    | `ntf_60337068…` push, `fallback_channel = email`, `failed`, `unreachable: no_live_device` |
| Fallback written   | `ntf_cdc72db7…` on `channel = email`, by the dispatcher, not the producer                 |
| Fallback delivered | `status sent`, `attempts 0`, **302 seconds** after the push row was written               |

**The first attempt did not send.** `ntf_e76cda03…` failed three times with
`Email send failed (E_VALIDATION_ERROR)` before the cause was found: the email dispatcher set its own
`Message-ID` header, which Cloudflare's Email Sending refuses. The OTP path sets no headers, which is
why authentication mail has always worked while notification mail had never once been delivered — the
branch only runs behind a push failure, and push had no provider until today. Header removed; the
retry above is the same code path succeeding.

**Latency is the re-arm floor, not a fault.** A push delivered in 7 seconds; the email fallback took 302. `NotificationScheduleDO` re-arms at `max(nextPendingSendAt, now + REARM_FLOOR_MS)` and
`REARM_FLOOR_MS` is five minutes, so a row written _by_ an alarm waits for the next one. Fine for a
reminder. For a confirmation the member is waiting on, five minutes is worth revisiting.

Cloudflare reports `sent`; that is acceptance by the provider, not receipt in an inbox.
