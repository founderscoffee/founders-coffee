# Notification Delivery Implementation Plan

| Field          | Value                                                                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status         | Planned. Nothing in this plan is implemented. ND-00 (delete the delivery and device boxes) landed on 2026-09-10 and is recorded here as done                    |
| Decision date  | 2026-09-10                                                                                                                                                      |
| Owner          | Founder / Product                                                                                                                                               |
| Scope          | Make push deliver, make every notification category real, and give the member per-category channel control                                                      |
| Parent tickets | PF-08 (preferences connected to delivery), CO-02 (alarm/queue), CO-03 (closeout and feedback persistence)                                                       |
| Related plans  | [Profile and account](./profile-account-implementation-plan.md), [community operations](./community-operations-implementation-plan.md), [secrets](./secrets.md) |

## 1. What is actually true today

Verified on 2026-09-10 by reading the send path and listing the deployed secrets in both
environments. This section is evidence, not recollection.

| Claim the product makes                    | What the code and the deployment say                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Push is the primary channel                | Every producer writes `channel: 'push'` (`producer.ts:149`, `cancellation.ts:70`). No environment can deliver one. Every notification ever sent has been a fallback                   |
| Push is configured                         | `wrangler secret list` on `ui` and `worker-jobs`, staging and production: no `FIREBASE_*` in any of the four. `getFirebaseConfig` returns `null`, `createPushProvider` returns `null` |
| The site is a PWA that can receive push    | `apps/ui/public/` contains no service worker and nothing in the app registers one. `getToken()` cannot mint a token without one                                                       |
| SMS is a fallback behind push              | True and working. `TWILIO_AID`/`TWILIO_SEC` secrets and `TWILIO_SMS_FROM` var are set in staging and production                                                                       |
| Email is not an event channel              | Mostly true. `producer.ts:105` excludes it by decision; `cancellation.ts:71` uses it as the fallback when a member has no phone                                                       |
| Four notification categories can be chosen | Two of them gate nothing. `resolveDestination` reads `eventReminders` and `eventUpdates` only (`notification-destination.ts:70-76`)                                                   |
| Four categories exist to be sent           | Four template keys exist — `rsvp_confirmation`, `reminder_72h`, `reminder_24h`, `event_cancelled` — and two producers. Nothing sends a host update or a follow-up                     |
| A member can consent to SMS                | No longer, as of ND-00. The consent control was in the deleted box. See §5                                                                                                            |

The net effect: **the product currently cannot deliver a notification to anybody.** Push has no
provider, and SMS requires `sms_fallback_enabled`, which now has no control that can set it.

## 2. The blocker that credentials do not fix

Setting the five `FIREBASE_*` values will not make push work on its own.

`firebase/messaging`'s `getToken()` registers `/firebase-messaging-sw.js` from the origin root and
fails without it. There is no such file and no `navigator.serviceWorker.register` call anywhere in
`apps/ui`. `isSupported()` returns true in any browser that _supports_ service workers, so
`readPushEnvironment` will report `configured: true` and the UI will offer to enable push; then
`enablePushOnThisDevice` swallows the registration failure in its `catch { return null }`
(`push/client.ts:105`) and the member sees a control that does nothing.

On iOS this is doubly load-bearing: web push requires both a Home-Screen install and a service
worker. `installRequiredFor` already tells iOS members to install the app, which is currently a
promise the deployment cannot keep.

**The service worker cannot be a static file**, because the Firebase config is server-owned —
`getFirebaseConfig` reads it from Worker env so it is never committed. Three options, in order of
preference:

1. **Serve it from a route.** A `/firebase-messaging-sw.js` server route renders the SW from env,
   with `Content-Type: application/javascript` and `Service-Worker-Allowed: /`. Config stays server
   -owned, no build step, one place to change. Register it explicitly and hand the registration to
   `getToken({ serviceWorkerRegistration })` rather than letting the SDK guess.
2. Generate the file at build time from env. Adds a build step and puts the API key in a built
   asset — acceptable (web API keys are public) but it splits config across two mechanisms.
3. Pass config on the query string of the SW URL. Works, but the config then appears in the SW's own
   URL and in every registration record.

Bundle the SDK into the SW rather than `importScripts` from `gstatic.com`: the CSP
(`libs/core/src/security-headers.ts`) allows `firebaseinstallations.googleapis.com` and
`fcmregistrations.googleapis.com` for `connect-src` and deliberately allows no external script
source, because the SDK is bundled. Reaching for `gstatic.com` in the SW would need a CSP change
that this plan does not want to make.

## 3. Credentials to set

Owned by the founder. `docs/secrets.md` §Firebase and §Notification delivery already describe each
value; this is the checklist, not a replacement for that page.

| Where         | Name                                                            | Notes                                                                       |
| ------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `ui`          | `FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, `FIREBASE_VAPID_KEY` | Required. Without all three `getFirebaseConfig` returns `null`              |
| `ui`          | `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`               | Optional in code, but FCM web needs the sender id in practice — set both    |
| `worker-jobs` | `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT`               | Service-account JSON: `wrangler secret put FIREBASE_SERVICE_ACCOUNT < file` |
| both          | staging **and** production                                      | Four secret lists, not two                                                  |

Twilio needs nothing. It is already set in both environments and its sender ID is a `var`, not a
secret, on purpose. The one thing worth confirming is that `TWILIO_AID` is the **live** SID: test
credentials return `20008` on every call and look like a delivery.

## 4. Tickets

### ND-00 — Remove the delivery and device boxes ✅ done 2026-09-10

- Deleted the _كيف نصل إليك_ group (push status row, SMS consent row, go-to-account link) and the
  _هذا الجهاز_ group from `/preferences`. Deleted `PushRow.tsx`, `PreferencesDelivery.test.tsx`,
  `SmsRow`, `DeviceLocationGroup`, and the six `prefs_location_*` keys in all three locales.
- **Retained deliberately, currently unreferenced by any component:** `push-state.ts`,
  `useDevicePushState`, `push/client.ts`, `device-location.ts`, and the `push_*` / `prefs_sms_*` /
  `prefs_delivery_*` copy. ND-06 re-attaches all of it. This is a documented gap with a named owner
  ticket, not dead code left to rot — if ND-06 is abandoned, delete them.
- Push permission can still be granted: `RsvpSection.tsx:181` offers it at RSVP time.

### ND-01 — Give the app a service worker

**Depends on:** the `ui` Firebase secrets. **Blocks:** everything else in this plan.

- Add the `/firebase-messaging-sw.js` route per §2 option 1, with the SDK bundled and the config
  read from env. Register it from the push client and pass the registration to `getToken`.
- Handle `onBackgroundMessage`: title, body, icon from `public/android-chrome-192x192.png`, and a
  click that opens the event URL the payload carries. `eventUrlFor` already builds market-slug URLs.
- Stop swallowing failures. `enablePushOnThisDevice` returning `null` for ten different reasons is
  why this blocker survived a whole feature. Return a discriminated reason, log it, and let
  `pushStateFrom` render it. Add `sw_registration_failed` to `PushState`.
- Acceptance: with the secrets set, a Chrome desktop and an installed iOS PWA both mint a token and
  a row lands in `push_subscriptions`. With the secrets unset, the state reads `unavailable` and no
  control offers to enable anything. A registration failure names itself on screen.

### ND-02 — Prove delivery end to end on staging

**Depends on:** ND-01, all four secret lists.

- RSVP on staging from a real device, confirm the DO alarm fires, the queue message routes, and the
  notification arrives as a push rather than a fallback. Compare against the CO-02 smoke, which
  measured 8 seconds from RSVP to confirmation on the SMS path.
- Confirm the fallback still works when push fails permanently: sign the device out, re-RSVP, expect
  the SMS. This is the one path that has ever run in production, and ND-01 must not break it.
- Record the evidence in `docs/deployment-evidence.md` — Worker versions, a token id, timings.
- Acceptance: a push received on a real handset in Algeria, and a deliberate push failure that lands
  on SMS with no duplicate.

### ND-03 — Make the two dead categories real

**Depends on:** ND-02. **Related:** CO-03, which persists feedback but exposes none of it.

`host_updates` and `follow_up_prompts` are stored, saved, rendered and read by nothing. Either they
send something or they leave the screen.

- **Host updates** — a producer on RSVP created and cancelled that notifies the event's host, gated
  on `hostUpdates`, with a new `rsvp_received` template. Batch it: a popular event should not text a
  host twenty times. A digest at a fixed delay, or a per-event cap, is a product decision to make
  here rather than discover in production.
- **Follow-up prompts** — a producer after `ends_at` with an `event_feedback_request` template,
  gated on `follow_up_prompts`, linking to a feedback surface. That surface does not exist:
  `libs/db/src/operations-feedback.ts` is the whole of it, with no server function and no route. The
  message cannot ship before the page it links to.
- Add both gates to `resolveDestination` alongside the two that are already there, and extend its
  test to cover all four rather than the two that happen to be wired.
- Acceptance: each of the four switches demonstrably stops a message that is otherwise sent. A test
  per category, driven through the real queue, not through the resolver in isolation.

### ND-04 — Per-category channel model

**Depends on:** ND-03.

- Do **not** add twelve booleans. Add one integer `channels` bitmask per category to
  `account_preferences` (`1` push, `2` sms, `4` email), keeping the single-row `revision` guard that
  makes concurrent saves safe. A side table breaks optimistic concurrency and buys nothing.
- Default per category from today's behaviour so no existing member's delivery changes on migration:
  push and SMS on, email off. The four existing booleans become `channels != 0` and stay as the
  category gate; they are not replaced, because "off entirely" must remain expressible in one bit.
- `updateAccountPreferencesSchema` gains the per-category channel sets, and `pushEnabled` stays
  server-owned and absent from the input, for the reason `draft.ts` already gives.
- Acceptance: a migration test asserting every pre-migration row lands on push+SMS for the
  categories it had enabled; a conflicting concurrent save still fails on `revision`.

### ND-05 — Producer and dispatcher honour the matrix

**Depends on:** ND-04. **This is the ticket the grid actually costs.**

- Producers stop hardcoding `channel: 'push'`. Each resolves the member's channel set for that
  category at enqueue, writes the primary, and writes `fallback_channel` from what is left.
- Decide and write down what a fallback means once the member has named their channels. The current
  semantics — push primary, SMS behind it — is a policy the member did not choose. When they have
  chosen, "fallback" should mean _the next channel they picked_, and no channel they did not pick.
- `resolveDestination`'s `account: true` refusal (true of every channel) needs revisiting: with
  per-category channels, "category off for this channel" is a channel-level refusal that should
  still allow the fallback, which is the opposite of today.
- `rsvp_confirmation` keeps bypassing category gates and must not bypass channel selection.
- Acceptance: for each of the four categories, a member with only SMS selected receives SMS and no
  push; a member with nothing selected receives nothing and no fallback row is written.

### ND-06 — The grid, and delivery controls come back

**Depends on:** ND-05.

- Replace the four toggles with four rows × the channels the deployment can actually serve. A column
  for a channel with no provider must not render — the lesson of the box ND-00 deleted is that a
  control which cannot work is worse than an absent one.
- Push permission moves into the grid: switching a push cell on for the first time is the user
  gesture that requests permission. This is better than the row it replaces — the ask now arrives
  attached to a thing the member just said they wanted.
- SMS consent comes back the same way: the first SMS cell switched on is the consent, recorded with
  `sms_consent_at` exactly as before, and disabled with an explanation when no verified phone
  exists. **This closes the §5 regression.**
- Re-attach `push-state.ts`, `useDevicePushState`, `device-location.ts` and the retained copy.
- RTL and 400px: four rows × three columns does not fit. Below `md`, each category becomes a row
  with channel chips beneath its label. Arabic is the primary case, not the check at the end.
- Acceptance: 390/768/1280 in `ar`, `fr`, `en`; every push state renders its own sentence; an
  all-off category reads as off without a second control saying the same thing.

### ND-07 — Decide about email

**Depends on:** ND-05. **Independent of the rest — this is a product decision with a cost.**

`producer.ts:105` states the position: email is for authentication and for a workflow the member
chose. Adding an email column reverses it. That is allowed, but it is a decision, and it has a
constraint the other channels do not: the `EMAIL` binding is Cloudflare Email Routing, not a
transactional provider. `libs/email/src/error-codes.ts` already maps `E_DAILY_LIMIT_EXCEEDED` and
`E_RATE_LIMIT_EXCEEDED`, which is the shape of the ceiling.

- If email becomes a per-category channel, size the daily volume against that ceiling first, and
  plan for a real ESP if reminders at scale exceed it.
- If it does not, remove the email column from ND-06 and leave email as the cancellation fallback it
  is today.
- Acceptance: whichever way it goes, the decision is written in this file with its reason.

### ND-08 — Release with evidence

**Depends on:** ND-01 through ND-06, ND-07 decided.

- Staging first, per the standing rule. Migration rehearsed on populated staging data.
- Record Worker versions, D1 bookmarks, the migration list and a real delivery on each live channel,
  in `docs/deployment-evidence.md`.
- Acceptance: a member on production receives a push, turns that category's push off, and stops.

## 5. Known limits and open risks

- **No member can consent to SMS right now.** ND-00 deleted the only control that writes
  `sms_fallback_enabled`, and push has no provider, so between now and ND-06 the product delivers
  nothing to anyone. Two ways out: run ND-06 early behind the rest of the plan, or accept the gap
  because push was already dead and a verified phone is rare today. **This is a deliberate choice,
  not an oversight — revisit it if the gap outlasts the plan.**
- **`docs/secrets.md` says the Firebase values are required and they have never been set.** A
  documented requirement is not a configured one; this plan exists because nothing checked.
- **The four preference switches have shipped to production gating almost nothing.** Two gate
  nothing at all. Members may have set them believing otherwise.
- **A per-category grid multiplies the promise.** Twelve controls over a system with four template
  keys means eight of them describe messages that do not exist. ND-03 is not optional decoration
  before ND-06; it is what makes the grid honest.
- **iOS web push needs the Home-Screen install.** Even after ND-01, an iOS member who has not
  installed the app cannot receive push, and the grid must say so rather than showing a dead switch.
- **The push column must hide itself when unconfigured.** The failure this plan starts from is a
  control rendered for a channel with no provider. ND-06 must read the real provider state, not a
  build-time flag.
