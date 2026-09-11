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
| The site is a PWA that can receive push    | It is not. `sw.ts` exists and handles `push`, but Serwist emits no `sw.js`, nothing registers one, and `/sw.js` is 404 in production. See §2                                          |
| SMS is a fallback behind push              | True and working. `TWILIO_AID`/`TWILIO_SEC` secrets and `TWILIO_SMS_FROM` var are set in staging and production                                                                       |
| Email is not an event channel              | Mostly true. `producer.ts:105` excludes it by decision; `cancellation.ts:71` uses it as the fallback when a member has no phone                                                       |
| Four notification categories can be chosen | Two of them gate nothing. `resolveDestination` reads `eventReminders` and `eventUpdates` only (`notification-destination.ts:70-76`)                                                   |
| Four categories exist to be sent           | Four template keys exist — `rsvp_confirmation`, `reminder_72h`, `reminder_24h`, `event_cancelled` — and two producers. Nothing sends a host update or a follow-up                     |
| A member can consent to SMS                | No longer, as of ND-00. The consent control was in the deleted box. See §5                                                                                                            |

The net effect: **the product currently cannot deliver a notification to anybody.** Push has no
provider, and SMS requires `sms_fallback_enabled`, which now has no control that can set it.

## 2. The blocker that credentials do not fix

Setting the five `FIREBASE_*` values will not make push work on its own. The service-worker half of
the chain is broken in four separate places, and each one is silent.

**A service worker is required on every platform.** A PWA install is required only on iOS — see §2.1.
Nothing here is about being installable; it is about the worker existing, shipping, registering, and
being the one FCM talks to.

1. **The worker is written and never built.** `apps/ui/src/sw.ts` is a complete Serwist worker with a
   `push` handler, a `notificationclick` handler that opens the event URL, and dedupe by tag. The
   `@serwist/vite` plugin is configured (`vite.config.ts:78`) with `swSrc: 'src/sw.ts'`,
   `swDest: 'sw.js'` and `globDirectory: 'dist'` — but TanStack Start emits the client bundle to
   `dist/client`, and `nx build public` produces no `sw.js` anywhere. `https://founders.coffee/sw.js`
   returns **404** in production today, while `manifest.json` returns 200. The build fails without
   failing.
2. **Nothing registers it.** `@serwist/window` is a declared dependency and is imported nowhere. There
   is no `navigator.serviceWorker.register` call in `apps/ui`. Even a correctly built `sw.js` would
   sit unused.
3. **FCM is not told to use it.** `push/client.ts:25` calls `getToken(messaging, { vapidKey })` with no
   `serviceWorkerRegistration`, so the SDK looks for `/firebase-messaging-sw.js` at the origin root —
   a file this repo does not have and, given `sw.ts` already exists, should not add. Pass the existing
   registration instead.
4. **The payload contracts disagree.** `FcmPushProvider` sends an FCM `webpush.notification` envelope
   (`push-provider.ts:126-135`); `sw.ts` reads a flat `{ title, body, url, icon, dedupeKey }` off
   `event.data.json()`. One of the two has to move. Sending a **data-only** message and letting `sw.ts`
   render it is the better direction: it keeps one code path for display, and `showNotification` stays
   ours rather than the SDK's.

`isSupported()` returns true in any browser that _supports_ service workers, so none of this surfaces
as an error. `readPushEnvironment` reports `configured: true`, the UI offers to enable push, and
`enablePushOnThisDevice` swallows the failure in its `catch { return null }` (`push/client.ts:105`).
The member clicks a control that does nothing, and no log records why.

### 2.1 Where a PWA install is actually required

| Platform                           | Service worker | Home-Screen install |
| ---------------------------------- | -------------- | ------------------- |
| Chrome / Edge / Firefox, desktop   | required       | no                  |
| Chrome / Firefox on Android        | required       | no                  |
| Safari / any browser on iOS ≥ 16.4 | required       | **yes**             |
| Safari on macOS                    | required       | no                  |

iOS is the only case, and `installRequiredFor` (`push-state.ts:73`) already encodes it: iOS user agent
and not `display-mode: standalone` ⇒ `install_required`, ranked above every other state because the
permission prompt does not exist until the app is installed. `manifest.json` is already correct for
that install — `display: standalone`, 192/512 icons, a maskable icon, theme colours.

Per `docs/mobile-research.md`, iOS is **~10-12%** of the Algerian market against 85%+ Android
(StatCounter, Jan 2026). So roughly nine in ten members can receive push in an ordinary browser tab
with no install at all, and the install requirement is a minority path that must be explained rather
than a prerequisite for the feature.

The CSP already allows what FCM needs — `firebaseinstallations.googleapis.com` and
`fcmregistrations.googleapis.com` for `connect-src` (`libs/core/src/security-headers.ts:17-32`) — and
deliberately allows no external script source, because the SDK is bundled. Keep it that way: no
`importScripts` from `gstatic.com` in the worker.

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

### ND-01 — Make the service worker ship, register, and receive — done 2026-09-10

**Depends on:** the `ui` Firebase secrets for the last two items only. **Blocks:** everything else.

The worker is already written. This ticket is the four breaks in §2, in order — none of them needs a
new `firebase-messaging-sw.js`, and adding one would give the app two workers competing for the same
push event. The two items that need no credentials are done; the rest waits on §3.

- ✅ **Build it.** `clientOnlyServwist` in `apps/ui/vite-service-worker.ts` drops the SSR
  `configResolved` so the plugin keeps the client config, and drops the SSR `closeBundle` so it
  generates once rather than twice. `assertServiceWorkerEmitted` fails the build when `sw.js` is not
  in the client output — proven by disabling Serwist and watching the build fail.
- ✅ **Bound the precache.** The worker precached 5.5 MB, 4 MB of it Mapbox, on first visit. Excluded
  via `precacheIgnores()`; now 1.29 MB.
- ✅ **Register it.** `registerServiceWorker` (`features/push/service-worker.ts`) via `@serwist/window`,
  called from the root layout, memoised on the promise, `null` rather than throwing, and retryable
  after a refusal.
- ✅ **Close the cache-privacy gap the registration opens.** Serwist's default runtime caching ends in
  a catch-all `NetworkFirst` storing any navigation for 24 hours, and `isPrivateProfilePath` listed
  neither `/preferences` nor `/activity`. Both added. `Cache-Control: private, no-store` on the route
  does not help — the strategy caches any 200 regardless.
- ✅ **Point FCM at it.** `getToken(messaging, { vapidKey, serviceWorkerRegistration })`, refusing to
  mint a token when there is no worker. **Wired, not yet proven** — needs the credentials.
- ✅ **Agree on the payload.** `FcmPushProvider` sends `webpush.data`, never `webpush.notification`,
  so display stays with `sw.ts`. `readPushPayload` normalises all three envelopes FCM can produce,
  because the real one cannot be observed until a push is delivered, and confines the click target
  to this origin.
- ✅ **Carry the URL.** `pushUrl` was never in the payload schema, never passed by the dispatcher and
  defaulted to `/` in the worker — a reminder about a gathering would have opened the home page.
  Added as an optional field, so rows queued by the deployed version still dispatch during a rollout.
- ✅ **Fix the icon.** The provider defaulted to `/icons/icon-192.png`, which this app does not have.
- ✅ **Fix the FCM authentication.** The provider signed an OAuth _assertion_ (`aud` = Google's token
  endpoint, with a `scope`) and sent it to `fcm.googleapis.com` as the bearer. That is a 401 on every
  message, and 401 is not in the permanent-failure list, so each would have been retried to the end of
  its budget before the SMS fallback was considered. It now exchanges the assertion at
  `oauth2.googleapis.com/token` and caches the access token.
- ⬜ **Stop swallowing failures.** `enablePushOnThisDevice` returning `null` for ten different reasons
  is why six separate breaks survived a whole feature and a production deploy. Return a discriminated
  reason, log it, and let `pushStateFrom` render it. Add `sw_unavailable` to `PushState`. **Still
  open** — the path works now, so nothing is hidden today, but the next break will hide the same way.
- Acceptance: `/sw.js` returns 200 on staging; a Chrome desktop tab and an installed iOS PWA both mint
  a token and land a row in `push_subscriptions`; a real FCM message renders with its own title and
  opens the event on click. With the secrets unset, the state reads `unavailable` and no control
  offers to enable anything. Every failure names itself on screen and in the log.

### ND-02 — Prove delivery end to end on staging — done 2026-09-10

**Depends on:** ND-01, all four secret lists.

Done, both halves. A push was delivered on staging 7 seconds after the RSVP, rendered with its own
Arabic title and a click target of `/algeria/e/react-workshop-algiers`. The fallback half was
unblocked by ND-07 — it no longer needs an SMS consent nobody can give — and a deliberate push
failure now lands on email in 302 seconds, the `REARM_FLOOR_MS` window. Evidence, including the
`E_VALIDATION_ERROR` that showed email had never delivered a notification in this product's life, is
in [deployment evidence](./deployment-evidence.md).

- RSVP on staging from a real device, confirm the DO alarm fires, the queue message routes, and the
  notification arrives as a push rather than a fallback. Compare against the CO-02 smoke, which
  measured 8 seconds from RSVP to confirmation on the SMS path.
- Confirm the fallback still works when push fails permanently: sign the device out, re-RSVP, expect
  the SMS. This is the one path that has ever run in production, and ND-01 must not break it.
- Record the evidence in `docs/deployment-evidence.md` — Worker versions, a token id, timings.
- Acceptance: a push received on a real handset in Algeria, and a deliberate push failure that lands
  on SMS with no duplicate.

### ND-03 — Make the two dead categories real

`host_updates` and `follow_up_prompts` are stored, saved, rendered and read by nothing:
`resolveDestination` gates on `eventReminders` and `eventUpdates` and no others. Either they send
something or they leave the screen.

Split on 2026-09-11, because the two halves are not the same size. One is a producer and some copy.
The other needs a page nobody has built.

#### ND-03a — Host updates

**Depends on:** ND-02.

- A producer on RSVP that tells the host somebody is coming, gated on `hostUpdates`, under a new
  `rsvp_received` template key. `template_key` is plain `text NOT NULL` in
  `0007_scheduled_notifications.sql` with no CHECK constraint, so the key costs no migration.
- **Coalesced, not batched into a digest.** A pending notice for the same event suppresses the next,
  so a burst of RSVPs produces one message and the window reopens once it sends. The alternative —
  accumulating names and counting them at send time — needs state the payload cannot carry, since a
  payload is frozen at enqueue and would report a count that was already stale.
- The message therefore carries no count. It says somebody joined and links to the event, where the
  real number lives. A notification that claims "3 going" while 5 are is worse than one that does
  not claim.
- The host never hears about their own RSVP.
- Acceptance: the switch demonstrably stops it; a burst produces one message; the host's own RSVP
  produces none.
- **Known limit, accepted.** A guest who cancels inside the coalescing window does not withdraw the
  notice. `cancelNotificationsByUserEvent` is keyed on the _guest's_ user id and the notice belongs to
  the host, so the host can be told somebody is coming, open the event, and find the list unchanged.
  Withdrawing it would mean tracking which guest triggered which pending notice — state this design
  deliberately does not keep — and the message is count-free and links to the event precisely so the
  truth is one tap away. Revisit with ND-03c, where cancellations get their own message.
- The delay is clamped to `startsAt`: §5.17 freezes RSVP intent at the start and not before, so a
  guest can join a minute beforehand, and a notice fifteen minutes later would reach a host already
  in the room.

#### ND-03b — Follow-up prompts

**Depends on:** ND-03a, and on CO-03 growing a surface above its persistence layer.

This is not a notification ticket. `libs/db/src/operations-feedback.ts` — `saveFeedback`,
`getFeedback`, `feedbackTally` — is the whole of the feedback feature, and nothing above the database
imports any of it: no server function, no route, no screen. A prompt after the gathering would link
to a page that does not exist.

- Build the feedback surface first, then a producer at `ends_at + delay` under an
  `event_feedback_request` key, gated on `followUpPrompts`. Scheduling needs nothing new — the same
  `NotificationScheduleDO` alarm that carries a 72-hour reminder carries this.
- **If the feedback surface is not coming soon, take the switch off the preferences screen instead.**
  A control that does nothing is the defect this whole plan started from.

#### ND-03c — Telling a host somebody dropped out

Deliberately not in ND-03a. A freed chair is worth knowing about, but a join and a cancellation
inside one coalescing window net out to nothing worth sending, and deciding what that message says is
a separate question from getting the first one working.

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

### ND-07 — Decide about email — decided and applied 2026-09-10

**Decision: push and email are the default pair. SMS survives only for same-day disruption.**

The old position (`producer.ts`) was that email is for authentication and for a workflow the member
chose, and that a reminder is neither. Both halves of that were wrong for this product.

- **Email costs nothing and reaches everyone.** Authentication here is an email OTP, so a member
  without a working, verified address cannot exist. That is an unusually strong guarantee and it is
  specific to this app.
- **Push has a floor it cannot cross.** iOS needs the app on the Home Screen — and the audience is
  founders, who skew iPhone well above Algeria's 10-12% share. A denied permission is permanent. A
  subscription dies quietly when a device is signed out, which is why `delivery_unavailable` exists.
  Realistically push reaches a minority; something has to sit underneath it.
- **SMS was billing per message to reach people the free channel already reaches** — a confirmation
  and two reminders per RSVP.
- **The templates already existed.** `emailPayloadFor` covers all four template keys with localised
  subject, HTML and text. This was a policy change, not a feature.

What SMS keeps is the one case email cannot cover: a cancellation close enough to the start that an
unread email means somebody crosses the city for nothing. `isSameDay` in `cancellation.ts` is that
line, and it is now the only place in the product that bills per message.

Applied:

- `enqueueRsvpNotifications` writes `fallback_channel = 'email'`, never `'sms'`, and carries the
  email body instead of `smsBody`. No fallback at all when there is no address.
- `enqueueEventCancellationNotices` falls back to SMS only for a consented number **and** an event
  within 24 hours; otherwise email. The payload now follows the resolved fallback rather than
  whether a phone exists — keying it off the phone was a live bug that wrote an SMS body into a row
  the dispatcher would send by email.
- RSVP copy no longer promises SMS. `rsvp_help`, `rsvp_confirmed_help` and `push_prompt_decline`
  said "SMS" in all three locales while the product had not sent one in months.

**Still open:** Cloudflare Email Routing is not a transactional ESP, and `error-codes.ts` already
maps `E_DAILY_LIMIT_EXCEEDED` and `E_RATE_LIMIT_EXCEEDED`. It carries OTPs today; reminders for every
RSVP are a different volume, and deliverability to Gmail matters more for a message nobody is waiting
for. Size it before the first busy month, and budget for Resend or SES.

**Consequence for the §5 gap:** restoring an SMS consent control is no longer urgent. Email reaches
every member, so the production deploy is now purely additive rather than a trade.

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
- **`docs/mobile-research.md` calls `apps/ui` "the installable Serwist PWA".** Serwist is installed
  and configured, `sw.ts` is written, and no `sw.js` has ever been served. A doc describing intent
  in the present tense is how this went unnoticed; that line should be corrected when ND-01 lands.
- **The four preference switches have shipped to production gating almost nothing.** Two gate
  nothing at all. Members may have set them believing otherwise.
- **A per-category grid multiplies the promise.** Twelve controls over a system with four template
  keys means eight of them describe messages that do not exist. ND-03 is not optional decoration
  before ND-06; it is what makes the grid honest.
- **iOS web push needs the Home-Screen install.** Even after ND-01, an iOS member who has not
  installed the app cannot receive push, and the grid must say so rather than showing a dead switch.
  Everywhere else a plain browser tab is enough; see §2.1. On the Algerian traffic mix that is a
  ~10-12% minority path, so it is a sentence to write well, not a reason to build an app.
- **The push column must hide itself when unconfigured.** The failure this plan starts from is a
  control rendered for a channel with no provider. ND-06 must read the real provider state, not a
  build-time flag.
