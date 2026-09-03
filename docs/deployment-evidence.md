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

**Not yet done.** Production preflight, migration, deployment, the WAF behavioral probe, and the
authorized smoke creation are all outstanding, and all of them are blocked on the same thing: the
apex `founders.coffee` has no resolvable DNS record. `www.founders.coffee` resolves and answers
`301` to the apex, so it redirects into a hostname that does not exist, and
`apps/ui/wrangler.jsonc` binds production to the apex as a custom domain. The zone
`267b77624c4953ba0040541ecc2930ae` is active; the record is missing.
