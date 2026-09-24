# Implementation Plan

## founders.coffee — current delivery plan (P0–P4)

| Field        | Value                                                                              |
| ------------ | ---------------------------------------------------------------------------------- |
| Version      | 2.9                                                                                |
| Status       | Active                                                                             |
| Owner        | Engineering                                                                        |
| Last updated | 2026-09-23                                                                         |
| Derived from | [SRS v1.7](./srs.md) and [community-first release strategy](./release-strategy.md) |

This document is the current sequencing and status source. Status is evidence-based:

- **Complete** — implemented and verified for the ticket’s stated scope.
- **Partial** — useful implementation exists, but acceptance or operational work remains.
- **Blocked** — unsafe to call complete; a named defect or prerequisite must be resolved first.
- **Planned** — no production implementation yet.
- **Future** — intentionally outside the current release and blocked from active delivery until the community validation gate and explicit Founder / Product approval.

## 1. Canonical product and architecture decisions

- DZ, EG, and SA are the only configured markets, and all three are `active`.
- MA and AE are removed from the market configuration. Migration `0029_activate_launch_markets`
  aligns existing rows; `SEED_MARKETS` keeps fresh local/test environments on the same policy.
- Expansion requires eight completed events per month for three consecutive months, three recurring hosts, and at least 60% host retention.
- D1 owns market configuration. Versioned TypeScript datasets own state/city reference data.
- Geographic records use `market_code`, `state_code`, and `city_code`.
- `apps/ui` owns member and host workflows; `apps/dashboard` is sponsor-only; `apps/admin` is an
  Arabic-only RTL internal operations console.
- The installable Serwist PWA is the committed mobile surface. React Native/Expo is research only.
- A session travels only in Better Auth's HttpOnly cookie, so its bearer plugin is off. Left on, it
  took the bare session token, which sits in D1 and which `get-session` returns to page scripts, as
  a login from anywhere. A non-web client, once approved, brings it back with
  `requireSignature: true`, and the device controls learn to read the header in the same change.
- PWA web push is the primary event-notification channel; email is the default fallback. SMS is
  reserved for same-day cancellations where an unread email could send someone to a venue unnecessarily.
- Per-entity reminders use Durable Object alarms feeding a Notifications Queue. Cron is recovery-only.
- A meetup can have a Telegram group, run through the official Telegram Bot API and nothing else:
  no MTProto client and no userbot, since both run as someone's own Telegram account, which would
  then carry the product's automation and the risk of that account being limited. A bot cannot
  create a group, so the host creates one and adds the bot as an admin through a `startgroup` link.
  The bot pins the meetup's details, posts changes, the cancellation and a 24-hour reminder, admits
  only members who are going, each through a personal join-request link, and removes a member who
  cancels. A day after the meetup ends it posts a thank-you, stops admitting and leaves; the group
  stays with the host, who can connect it to their next meetup (P1-025, #15).
- TypeScript 6, public base locales `ar`/`fr`/`en`, Arabic-only RTL admin copy, and shared Zod
  validation are canonical.
- TanStack Form is optional; local React state is acceptable when it reuses the shared Zod contract.
- AI lives at `@founders-coffee/core/ai`; delivery providers live in `libs/notifications`.
- Community membership, events, participation, and ordinary hosting are free. Commercial hosted challenges are B2B services.
- The current release is community-building only: free local events, repeat participation, hosts,
  trust/moderation, and the PWA operations required to run that loop.
- Hackathons, sponsorship products, talent, payments, and expansion are future work. Existing
  foundations may remain, but none is a current launch requirement or an authorized next task.

## 2. Repository and data flow

```text
apps/
  ui/             member/host PWA
  dashboard/      sponsor portal
  admin/          internal operations console
  worker-jobs/    asynchronous and recovery work

libs/
  auth/ core/ db/ domain/ email/ i18n/ infra/ notifications/
  observability/ payments/ server-fns/ ui/

libs/core/src/ai/ server-only Workers AI and Vectorize ports
```

```text
component → hook → feature api.ts → server function → domain → repository → D1
```

Route loaders may wire server functions directly. Runtime imports from presentational components must pass through feature hooks and APIs.

## 3. Platform state

| Capability             | Required architecture                                        | Current state                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sessions               | D1                                                           | Implemented                                                                                                                                                                                                                                                                                                                                                                      |
| Identity rate limiting | Durable Object + WAF; Better Auth may additionally use D1    | Partial; `RateLimiterDO` is bound and deployed to staging, and one active Free-plan zone rule covers auth and server-function paths in both environments. The remaining mutation audit belongs to P1-018                                                                                                                                                                         |
| Feature/config cache   | KV for idempotent reads only                                 | Planned, not bound                                                                                                                                                                                                                                                                                                                                                               |
| Event reminders        | DO alarms → Notifications Queue; low-frequency Cron recovery | CO-02 is deployed in staging and production. `NotificationScheduleDO` holds one alarm per event, publishes `notification_due` to the queue and rearms from D1; the cron is a fifteen-minute recovery sweep. `apps/ui` binds the class across scripts, so worker-jobs deploys first. See [deployment evidence](./deployment-evidence.md#current-operational-snapshot--2026-09-14) |
| PWA push               | FCM web push                                                 | Configured and proven on staging on 2026-09-10: the service worker ships/registers, FCM mints a session-linked token, and a real push opens the event route. Production credentials and delivery parity must be rechecked when the post-ND-07 code is promoted                                                                                                                   |
| Notification fallback  | Cloudflare Email; SMS for same-day cancellation only         | ND-07 is the active policy. Staging proves email fallback; the deployed production CO-02 version predates ND-07 and remains a promotion task. SMS consent is not a general reminder prerequisite                                                                                                                                                                                 |
| Authentication SMS     | Twilio Verify via `libs/auth`                                | Implemented; deployed environments must fail closed if credentials are absent                                                                                                                                                                                                                                                                                                    |
| Email                  | Cloudflare Email                                             | Code complete; sender-domain/DNS activation requires verification                                                                                                                                                                                                                                                                                                                |
| Search/AI              | Workers AI + Vectorize                                       | Foundations implemented; nonessential AI work is future and not a community-release blocker                                                                                                                                                                                                                                                                                      |
| Uploads                | R2 + Images                                                  | PF-06 is deployed with private per-environment R2 buckets and the Images transform binding; the buckets are currently empty. Ongoing free-tier usage and cleanup monitoring remain                                                                                                                                                                                               |
| Product metrics        | Analytics Engine                                             | Binding is active and the `events_created` metric is verified; community-health dashboards and alerts remain planned                                                                                                                                                                                                                                                             |
| Admin isolation        | Access + in-Worker JWT verification + no `workers.dev`       | Worker guard complete and `workers_dev: false` verified live on staging (the `workers.dev` URL returns 404). `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` are unset in staging, so every admin request fails closed with 403 — correct behaviour, but admin is non-functional there until they are configured                                                                     |
| Telegram groups        | Bot API webhook; posts through the Notifications Queue       | Built on develop, not configured or deployed anywhere. Each environment needs its own bot, its secrets and a registered webhook; see [Telegram groups](#telegram-groups-p1-025)                                                                                                                                                                                                  |

## 4. Phase P0 — foundation

| ID     | Status   | Scope                                                          | Remaining evidence or work                                                                                                                                                                                                                                                                       |
| ------ | -------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0-001 | Complete | Nx workspace, TypeScript, lint boundaries, Vitest              | All applications carry explicit layer tags, Nx module-boundary constraints are active, `local/no-server-fns-in-components` guards `components/`, `lib/`, and `features/`, and Istanbul coverage gates run for `libs/domain` and `libs/server-fns`. P0-001 enforcement and regression tests pass. |
| P0-002 | Complete | Public TanStack Start Worker                                   | —                                                                                                                                                                                                                                                                                                |
| P0-003 | Complete | Future sponsor dashboard scaffold                              | Dormant foundation; no community-release product UI                                                                                                                                                                                                                                              |
| P0-004 | Complete | Admin Worker and Access JWT guard                              | Access applications, in-Worker JWT verification, production operator setup, and end-to-end correlation are verified under the deployment evidence                                                                                                                                                |
| P0-005 | Complete | Core Result, AppError, Money, IDs, config                      | —                                                                                                                                                                                                                                                                                                |
| P0-006 | Complete | D1/Drizzle schema, migrations, atomic helpers                  | —                                                                                                                                                                                                                                                                                                |
| P0-007 | Complete | Market configuration and geography                             | Migration `0029_activate_launch_markets` and the seeded policy are verified in staging and production: exactly DZ/EG/SA are present and all three are `active`; MA/AE are absent                                                                                                                 |
| P0-008 | Complete | Better Auth, phone/email OTP, OAuth, RBAC                      | Production authentication, provider fail-closed behavior, and the public login flow are verified                                                                                                                                                                                                 |
| P0-009 | Complete | Public Arabic-first `ar`/`fr`/`en` i18n; Arabic-only admin RTL | —                                                                                                                                                                                                                                                                                                |
| P0-010 | Complete | Shared Tailwind/DaisyUI design system                          | —                                                                                                                                                                                                                                                                                                |
| P0-011 | Partial  | Typed resources and image-provider foundation                  | PF-06's R2/Images upload path and per-environment bindings are deployed; ongoing quota/cleanup monitoring and broader media consumers remain                                                                                                                                                     |
| P0-012 | Complete | Server-function throw boundary, context, authz primitives      | —                                                                                                                                                                                                                                                                                                |
| P0-013 | Complete | Shared Zod validation convention                               | —                                                                                                                                                                                                                                                                                                |
| P0-014 | Partial  | Structured logging and metrics API                             | Analytics binding, dashboards, and alerts remain                                                                                                                                                                                                                                                 |
| P0-015 | Partial  | Future manual Order/Invoice payment foundation                 | Dormant foundation; legacy cleanup is not a community-release blocker                                                                                                                                                                                                                            |
| P0-016 | Complete | Cloudflare Email provider and templates                        | Branded OTP/notification templates, right-aligned RTL content, localized copyright footer, named sender (`Founders Coffee <no-reply@founders.coffee>`), and the 30-minute email OTP expiry are deployed and verified                                                                             |
| P0-017 | Complete | Future Workers AI/Vectorize foundation                         | No current work unless the community event loop demonstrates a concrete need                                                                                                                                                                                                                     |
| P0-018 | Partial  | Jobs Worker                                                    | CO-02 alarm/Queue scheduling is deployed to both environments and push/email delivery is proven on staging. Remaining work is production promotion of ND-07 and the outstanding provider/observability checks                                                                                    |
| P0-019 | Complete | Staging/production Cloudflare provisioning                     | Staging and production Worker deployments, D1/R2/Email/DO/Queue bindings, queues and DLQs, provider secrets, and sender configuration are provisioned. Production admin login with the shared UI Turnstile credentials was tested successfully on 2026-09-16.                                    |
| P0-020 | Complete | GitHub Actions verification and environment deployments        | Format, sync, typecheck, lint, test, build, Miniflare integration, migration compatibility, rollback-state capture, Worker deployment, production SEO smoke, and release publication are green in production. `rollback.yml` refuses Worker versions the manifest cannot clear.                  |
| P0-021 | Partial  | Miniflare and Playwright harness                               | Critical-flow E2E remains a local/staging release gate; E2E is excluded from CI by current decision                                                                                                                                                                                              |

## 5. Phase P1 — community launch

| ID     | Status   | Scope                                                                | Remaining evidence or work                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------ | -------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1-001 | Complete | Market resolution and visibility                                     | Resolution logic and deployed market-row alignment are verified under P0-007                                                                                                                                                                                                                                                                                                                                                                             |
| P1-002 | Complete | Geo redirect, canonical market/city pages, empty states              | —                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| P1-003 | Partial  | Email-OTP login UI, OAuth UI, and dormant phone-OTP capability       | Verify current email/OAuth production flow; keep unexposed phone endpoints fail-closed                                                                                                                                                                                                                                                                                                                                                                   |
| P1-004 | Partial  | Geography datasets, onboarding, profiles                             | PF-01 through PF-12 in the [Profile and Account Management Plan](./profile-account-implementation-plan.md): remove home location, add editable opt-in public profiles and full account controls; preserve event geography                                                                                                                                                                                                                                |
| P1-005 | Complete | Event domain, repository, server functions                           | —                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| P1-006 | Complete | Event creation wizard and Mapbox venue selection                     | EC-01 through EC-10 are signed off. Staging 18/18, production release/DNS/WAF evidence, and the authorized production creation smoke were verified by 2026-09-10.                                                                                                                                                                                                                                                                                        |
| P1-007 | Partial  | Event feed/detail, virtualization, SEO metadata                      | Canonical/OG URL inheritance, missing sitemap, cookie-only locale indexing, incomplete event/city metadata and structured data, crawlable utility routes, missing social images, and unverified TanStack Start prerender configuration are tracked in the [SEO Implementation Plan](./seo-implementation-plan.md) as SEO-01 through SEO-12. GEO-01 through GEO-05 are implemented and locally verified; full prerender verification remains under P1-020 |
| P1-008 | Partial  | Immediate idempotent RSVP and cancellation                           | Full-capacity atomicity is fixed and proven by AR-04: a rejected RSVP writes nothing, a duplicate returns the typed `already_rsvpd`, and counter and attendee rows are asserted to agree. RSVP is session-bound, so it uses authz and rate limiting without a browser Turnstile challenge                                                                                                                                                                |
| P1-009 | Partial  | PWA push primary, email fallback, SMS same-day cancellation          | CO-02 is deployed; ND-01/ND-02 prove service-worker push and email fallback on staging. CO-06 and CO-07 add attendee follow-up and repeat-host support locally; production promotion and CO-08 host, correction, and operations delivery remain                                                                                                                                                                                                          |
| P1-010 | Partial  | Live event Durable Object/WebSocket experience                       | Verify session expiry (checked at each heartbeat alarm, so within 45 s, and before each state-changing message), heartbeat cleanup, and cancellation behavior                                                                                                                                                                                                                                                                                            |
| P1-011 | Future   | Disclosed sponsorship surfaces                                       | Post-community gate; not part of the current release                                                                                                                                                                                                                                                                                                                                                                                                     |
| P1-012 | Future   | Sponsor media through R2/Images                                      | Post-community gate; not part of the current release                                                                                                                                                                                                                                                                                                                                                                                                     |
| P1-013 | Planned  | Community moderation, host trust, and essential operations           | CO-04 delivered the correlated admin auth shell and staging verification; CO-08/09 still own event operations, weekly review, corrections, trust, moderation, and audit                                                                                                                                                                                                                                                                                  |
| P1-014 | Future   | Admin manual payment confirmation and audit                          | Post-community gate; not part of the current release                                                                                                                                                                                                                                                                                                                                                                                                     |
| P1-015 | Future   | Semantic event search                                                | Reconsider only when event density makes semantic search materially useful                                                                                                                                                                                                                                                                                                                                                                               |
| P1-016 | Complete | Host tools assigned to `apps/ui`; dashboard sponsor-only             | No separate host dashboard will be built                                                                                                                                                                                                                                                                                                                                                                                                                 |
| P1-017 | Complete | App middleware, D1 injection, auth mount, i18n, observability wiring | Production admin correlation, session wiring, and CSRF-origin verification are recorded under P0-004/P1-017                                                                                                                                                                                                                                                                                                                                              |
| P1-018 | Partial  | Security hardening                                                   | Event creation has the identity DO limiter and active shared Free-plan WAF rule; public auth/waitlist operations retain Turnstile. Event creation and other session-bound mutations intentionally do not render or require a browser challenge; remaining work covers anonymous metered map endpoints and undeclared mutation permissions                                                                                                                |
| P1-019 | Partial  | Observability                                                        | Structured logs and the first Analytics Engine metric (`events_created`, EC-08) exist; remaining product metrics, dashboards, and alerts remain                                                                                                                                                                                                                                                                                                          |
| P1-020 | Partial  | Installable PWA                                                      | Manifest/service worker exist; offline, prerender, Lighthouse, and PWA Builder verification remain                                                                                                                                                                                                                                                                                                                                                       |
| P1-021 | Partial  | End-to-end tests                                                     | EC-09/10 recorded 18/18 locally and on staging across ar/fr/en at 390/768/1280 on 2026-09-03; the authorized production creation smoke was verified on 2026-09-10. CO-11 remains, and E2E stays outside CI.                                                                                                                                                                                                                                              |
| P1-022 | Future   | Browser-rendered OG images                                           | Optional future growth work; not a community-release blocker                                                                                                                                                                                                                                                                                                                                                                                             |
| P1-023 | Partial  | Community operations and retention loop                              | CO-01 through CO-07 are implemented locally; CO-02/CO-03 are deployed to both environments, CO-04/CO-05 are staging-verified, and CO-06/CO-07 are locally verified. Staging/production promotion and CO-08 through CO-11 evidence remain                                                                                                                                                                                                                 |
| P1-024 | Partial  | SEO discoverability and search-engine operations                     | SEO-01 through SEO-11 and GEO-01 through GEO-05 are implemented and locally or staging verified. Remaining SEO-12 Search Console operations stay tracked in the [SEO Implementation Plan](./seo-implementation-plan.md)                                                                                                                                                                                                                                  |
| P1-025 | Partial  | Meetup Telegram groups through the Bot API                           | Built on develop, not deployed: migration 0036, the webhook, the queued posts, pins and removals, the host's panel and the member's card. Remaining: review of the privacy-policy draft (0572ecf) and its date; per environment, a bot set up as [Telegram groups](#telegram-groups-p1-025) lists; then staging evidence with a real group, including whether a basic group takes join-request links                                                     |

### Public profile (P1-004)

The public profile answers one question: should I show up to coffee with this person? It is not a
portfolio.

**What it shows.** The display name, photo, and introduction are public whenever they are set. So
are, with no toggle, the month the account was created, because an account age its owner could hide
would say nothing to the person deciding whether to meet them, and the day and time never leave the
server (#89); and how many meetups the member hosted in the last two years that their closeouts say
took place, because hosting is already public in the list of meetups they ran (#26). Everything else
is published only by its own toggle, and every toggle starts off: what the member is building, as
one line of up to 80 characters, and how far along it is, as `idea`, `building`, or `launched`
(#89); interests; spoken languages; a personal website; and how many meetups the member attended in
the last two years (#90). Clearing a field withdraws its publication.

**The meetup record.** Both counts come from closeouts and include only meetups whose closeout says
they took place. Attendance is what hosts recorded at closeout, and a no-show is never counted or
shown. A meetup that did not happen is left out rather than counted against anybody, and the record
never sets a total beside a count, though the list of meetups a host ran still shows its own.
Attendance is a count and not a list, because a list would publish where someone was; #91's tabs
stay deferred for the same reason. The window is the operations retention period, 730 days measured
on each meetup's start, and the profile says "in the last two years": closeouts and attendance are
deleted at that age, so a longer claim would shrink as they retire.

**What it will not become.** Features that are neutral on a hiring network are not neutral for
members meeting strangers in DZ, EG, and SA. These boundaries change only through an explicit
decision about member safety, never as a side effect of a growth or SEO ticket (#92):

1. **The profile stays `noindex`.** Public means reachable with the link, not on the open web:
   `/u/$userId` keeps `X-Robots-Tag: noindex` and `Cache-Control: private, no-store`.
2. **No followers or following.** A follower graph publishes who knows whom, which cannot be
   withdrawn once seen, and ranks people by popularity.
3. **No direct messages.** Messages from a cold profile are a harassment surface, so a profile
   offers no way to write to its owner. Member-to-member contact goes through a shared event. On
   2026-09-24 that came to include the meetup's Telegram group (P1-025, #15): people who are going
   can talk there before and after, and can message each other on Telegram. That was decided
   knowingly. Joining is each member's choice, the bot admits only people who are going, and it
   removes anyone who cancels.
4. **No resume, employers, or verified credentials.** This is not a hiring product.
5. **No public posts or feed.** Moderating them across three countries and three languages serves no
   part of the core question.
6. **No no-show counts, ratios, or reliability scores.** `event_attendance` records no-shows, and
   none of it is published: a profile shows positive counts only, never a denominator.
7. **Social proof attaches to events, not people.** Nothing rates a person.

### Telegram groups (P1-025)

Staging and production each run a bot of their own, because Telegram sends a bot's updates to one
webhook. For each environment, in this order:

1. **Create the bot** in BotFather with `/newbot`, and leave `/setjoingroups` enabled. Privacy mode
   can stay on: the bot is an admin in its groups, and Telegram sends admins every message.
2. **Set the secrets.** In `apps/ui`, `wrangler secret put TELEGRAM_BOT_TOKEN --env <env>` and
   `wrangler secret put TELEGRAM_WEBHOOK_SECRET --env <env>`, the second a random value such as
   `openssl rand -hex 32` (Telegram allows letters, digits, `_` and `-`, up to 256). In
   `apps/worker-jobs`, the same `TELEGRAM_BOT_TOKEN`; without it every group row is refused rather
   than marked sent. `TELEGRAM_BOT_USERNAME`, without the `@`, goes in that environment's `vars` in
   `apps/ui/wrangler.jsonc`, since it is public: the deploy runs a plain `wrangler deploy`, which
   drops a var set only in the dashboard. The username, the webhook secret and the token together
   switch the feature on; until all three are set, no page offers it.
3. **Deploy.** A push to `develop` (staging) or `main` (production) applies migration 0036, then
   deploys worker-jobs before ui.
4. **Register the webhook** at the environment's own address (`https://founders.coffee` in
   production), from the operator's own machine, with the token read so it is not echoed:

   ```bash
   read -rs TELEGRAM_BOT_TOKEN && read -rs TELEGRAM_WEBHOOK_SECRET
   curl -sS "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
     --data-urlencode "url=https://staging.founders.coffee/api/telegram/webhook" \
     --data-urlencode "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
     --data-urlencode 'allowed_updates=["message","my_chat_member","chat_join_request"]' \
     --data-urlencode "drop_pending_updates=true"
   ```

   `getWebhookInfo` on the same token should then show the URL, the three update types, and no
   `last_error_message`. A webhook secret changed later has to be registered again the same way.

Locally, `TELEGRAM_BOT_USERNAME` and `TELEGRAM_WEBHOOK_SECRET` in `apps/ui/.dev.vars`, with no
token, switch the feature on against the development provider, which records calls instead of
making them. Updates are then posted by hand to `/api/telegram/webhook` with the
`X-Telegram-Bot-Api-Secret-Token` header: a `/start@<bot> <token>` message from the host's connect
link, and a `chat_join_request` whose link a member was given.

Not yet known, and part of the staging evidence: whether a basic group accepts the bot's
join-request links, or Telegram first turns it into a supergroup. The webhook follows a group to its
new id when it is upgraded, so either way should work, but only a real group will show it.

**Staging run.** This is the evidence P1-025 still owes, run once the four steps above are done on
staging. It needs two staging accounts, a host and a member; a Telegram account for each, and a
third for step 4; and a group the host's Telegram account has just created, because a new group
starts as a basic group. Keep `wrangler tail` open on `founders-coffee-ui-staging` and
`founders-coffee-worker-jobs-staging`. The first logs `telegram.connect_opened`,
`telegram.connected`, `telegram.invite_given`, `telegram.join_request` and `telegram.disconnected`;
the second logs a `notification.sweep` report for each run. Stop on any `telegram.*` warning and
find out why.

1. **Meetup.** The host creates one starting about 25 hours ahead. The group's reminder, due a day
   before the start, is queued only if that moment is still ahead when the group connects, so
   connect within the hour; the reminder then posts about an hour after the meetup was created.
2. **Connect.** Connect, then Open Telegram within the link's 30 minutes, pick the new group, and
   keep the three admin rights ticked. The panel names the group as connected, and the bot pins the
   details. If the bot answers in the group that it lacks a right, grant it in Telegram and open a
   new link. If Telegram makes the group a supergroup on the way, the pin and every later post land
   in the supergroup, and the group's `chat_id` turns into a `-100…` id.
3. **Join.** The member RSVPs, asks for their invite link and opens it. Telegram sends a join
   request, the bot approves it (`admitted: true`), and the card says the member is in the group.
4. **A forwarded link.** The third account opens the member's link. The bot declines its request
   (`admitted: false`), because a link belongs to the first account that used it.
5. **Reminder.** It posts about an hour after the meetup was created.
6. **Edits.** An address edit rewrites the pin without a post. A new time or venue is posted, and
   the pin rewritten.
7. **Cancelled RSVP.** The member cancels, and the bot takes them out of the group and revokes their
   link.
8. **Endings.** On a second meetup, connect a second group and try the other endings in turn,
   connecting again between them: Disconnect, and the bot revokes its links and leaves while the
   group stays the host's; removing the bot in Telegram, and the panel offers Connect again; and
   last, cancelling the meetup, and the bot posts the cancellation, rewrites the pin and leaves. The
   group has to be a second one, because the bot stays in a chat that another meetup still runs
   through.
9. **The day after.** A day after the first meetup ends, the bot posts its thanks with the city's
   next meetups and leaves. Moving that meetup's start forward after step 5 brings this closer.

Throughout, `getWebhookInfo` should show no `last_error_message`, and the bot should post in the
meetup's language, with links to staging. A 403 there would mean something at Cloudflare's edge,
such as Bot Fight Mode or a WAF rule, is turning Telegram away. The groups' rows can be read from
`apps/worker-jobs`:

```bash
wrangler d1 execute founders-coffee-db-staging --remote --env staging \
  --command "SELECT event_id, status, chat_id, chat_title FROM event_telegram_groups"
```

Record the date, the commit and each step's result under this section. Only the web half of the run
could be scripted: the Telegram side would mean scripting real Telegram accounts, which section 1
rules out, and Telegram's test environment would need a new client library in the test harness.

### Enum contract consolidation

The enum audit identified repeated finite-value declarations across the core, database, domain,
server-function, worker, and UI layers. These tickets consolidate active contracts without changing
stored values or runtime behavior. Core owns values shared by persistence and delivery boundaries;
domain owns feature-specific input contracts. Dynamic market/geography codes, provider identifiers,
routes, HTTP values, i18n keys, and UI/protocol/infrastructure-only state remain scoped to their
owning module.

| ID      | Status   | Scope                                                                                                                                                                | Remaining evidence or work                                                                                                                                     |
| ------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ENUM-01 | Complete | Establish canonical `as const` arrays, inferred unions, and Zod schemas in `libs/core`                                                                               | Targeted and Nx-wide typecheck/lint/build verification passes; stored values and runtime behavior are unchanged                                                |
| ENUM-02 | Complete | Replace duplicate locale, lifecycle, notification, push, venue-kind, profile-asset, operations, and DB contracts with canonical imports and compatibility re-exports | Targeted and Nx-wide typecheck/lint/build verification passes; stored values and runtime behavior are unchanged                                                |
| ENUM-03 | Complete | Finish domain-owned contracts for notification categories, account providers, and venue categories with reusable schemas and boundary imports                        | Targeted domain/server typecheck, lint, and tests pass; provider IDs, routes/protocol values, and UI-only states remain intentionally scoped                   |
| ENUM-04 | Complete | Establish core-owned contracts for transient RSVP, waitlist, attendance, closeout, feedback, prompt, notification-dispatch, and operations-error outcomes            | Core outcome schemas and guards are covered by Vitest; stored values and runtime behavior are unchanged                                                        |
| ENUM-05 | Complete | Adopt the ENUM-04 contracts in D1 repositories, server functions, and notification jobs, keeping compatibility exports and documenting intentional local unions      | DB, server-fns, and worker-jobs typechecks and tests pass; UI/protocol/infrastructure state and dynamic identifiers remain local by design                     |
| ENUM-06 | Complete | Remove the remaining duplicated profile-photo variant and test-harness locale declarations where a shared contract is appropriate                                    | UI photo URLs reuse the domain variant; E2E and UI integration suites reuse the core locale contract; test matrices and SEO tooling remain intentionally local |

### Tooling and documentation closure

| ID      | Status   | Scope                                                                                                         | Evidence                                                                                                                                                                       |
| ------- | -------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TOOL-01 | Complete | Keep Nx project-graph evaluation independent of generated i18n output while retaining NodeNext source imports | `apps/ui` config-time sitemap metadata imports the canonical leaf locale contract; clean graph, Nx-wide typecheck/lint, public build, i18n/UI tests, and server-fns tests pass |
| TOOL-02 | Complete | Keep the format gate independent of generated inlang output while still checking the tracked `settings.json`  | `.prettierignore` mirrors inlang's `.gitignore`; after a clean `generate-i18n` the format gate passes and still fails a misformatted `settings.json`; Nx-wide lint passes      |

### Remaining work order

Audit-remediation tickets are tracked in the
[Audit Remediation Plan](./audit-remediation-plan.md). AR-02 through AR-07 and AR-09 through AR-13
are complete for the public Worker. AR-08's CSP and secure headers
were enforced in staging and production on 2026-09-04; `apps/admin` remains report-only because its
Access-gated origin still needs an authenticated measurement. The later [deployment evidence](./deployment-evidence.md)
records CSP enforcement, Queue consumers, the EC release and the Round Table redesign. This is
documentary evidence, not a new live CI or infrastructure certification.

The following order supersedes older sequencing notes in this document and its supporting plans.
Each step is a release or verification dependency; completed work is retained as evidence and is
not repeated.

1. **Maintain release foundations:** retain the completed `P0-004`, `P0-008`, `P0-016`, and `P0-019`
   deployment evidence and recheck account-side provider and secret state whenever an environment
   changes.
2. **Close security gaps:** complete the anonymous map protection and remaining mutation permissions
   under `P1-018`; authenticated RSVP and other session-bound mutations use authz plus rate limiting
   without a browser challenge. Replace the removed dependency-advisory gate and record token-rotation
   evidence when the CI replacement is approved.
3. **Promote notification delivery:** ship and verify `P0-018/P1-009/ND-08` so production matches
   staging's push-primary/email-fallback policy, including real provider delivery evidence.
4. **Verify live event coordination:** complete `P1-010` Durable Object expiry, heartbeat cleanup,
   and cancellation behavior.
5. **Build operational administration:** deliver `CO-08/CO-09` for event operations, corrections,
   moderation, host trust, and audit.
6. **Deliver community-health evidence:** implement `CO-10/P1-019` metrics repositories, dashboards,
   alerts, retention snapshots, denominators, and as-of evidence.
7. **Run the operational launch rehearsal:** complete `CO-11/P1-021/P1-023` across all checkpoints,
   locales, directions, roles, mobile/desktop surfaces, and recovery paths.
8. **Finish PWA verification:** complete `P1-020` offline behavior, prerender verification, Lighthouse
   budgets, and PWA Builder checks.
9. **Complete profile/account work:** finish `PF-04c`, then `PF-09` export, `PF-10` deletion and
   retention, `PF-11a/PF-11b` CO integration and localized UX, and `PF-12` release evidence.
10. **Complete search-engine operations:** deliver `SEO-12` Search Console/Bing submission, sitemap
    processing, representative URL indexing, and 30-day monitoring; finish full prerender evidence.
11. **Complete notification controls:** `ND-06` provider-aware, responsive per-category controls and
    push-permission UX are implemented; retain `ND-08` production evidence as the release gate from
    step 3.
12. **Close documentation:** `TOOL-01` resolved the Nx-wide i18n source-import graph error and
    Nx-wide lint is green; keep deployment evidence synchronized with the SEO and notification plans.

Future sponsorship, challenges, talent, payments, semantic search, browser-generated OG images, and
new-market expansion remain outside this order behind the community validation gate.

### P1 exit criteria

- urgent scheduler, RSVP, and security blockers resolved;
- production secrets, Email Sending, Access, and push/email delivery verified;
- full signup → create event → RSVP → notification → pre-start cancellation flow green in Playwright;
- RTL/LTR, offline PWA behavior, and performance budget verified;
- essential event moderation and lightweight host-trust operations verified;
- RSVP intent frozen at event start; post-event prompts, closeout, attendance, feedback windows,
  admin identity correlation, weekly review records, and rollback behavior verified;
- held/did-not-happen correction side effects and bounded retention/anonymization verified;
- community release live and ready for the Algiers operating phase.

### Community validation gate

Technical P1 completion does not authorize P2–P4. After launch, operate the Algiers community until
it demonstrates at least eight completed events per month for three consecutive months, at least
three recurring hosts, at least 60% host retention, and evidence of healthy repeat participation.
Founder / Product must review that evidence and explicitly open any future phase. If the community
loop fails, prioritize fixing or reconsidering it instead of starting a later product layer.

## 6. Phase P2 — challenge engine (future)

**Status: Future.** This is not active or current-release scope. It may be reconsidered only after the
community validation gate and explicit Founder / Product approval. If opened, it remains
feature-flagged and uses Workflows/DO alarms plus Queues for lifecycle work—never global D1 polling.

Deliver challenge creation, registration, teams, submissions, judging, results, integrity controls, and manual local-currency payouts. Community participation is free; commercial hosted challenges are paid B2B services.

## 7. Phase P3 — sponsorship and talent (future)

**Status: Future.** This is not active or current-release scope. Reconsider it only after the community
validation gate and explicit Founder / Product approval; no future sponsorship implementation is
authorized by this roadmap.

- `apps/dashboard` becomes the sponsor-only portal.
- Disclosed sponsorship, measurement, and reporting remain mandatory.
- Talent introductions require explicit, revocable participant consent.
- A standalone project showcase is not committed scope.

## 8. Phase P4 — automated payments and expansion (future)

**Status: Future.** Payment automation and additional-market operations require the community validation gate, explicit Founder / Product approval, and the relevant compliance review. The current configured markets are DZ, EG, and SA; adding another market requires a separate geography, operations, and compliance decision.

## 9. Continuous gates

- Every change maps to a ticket and SRS requirement.
- Run `nx sync:check`, typecheck, lint, unit/integration tests, and relevant Playwright tests.
- Test Cloudflare bindings through Miniflare; provider-interface fakes are allowed only for external services or bindings Miniflare cannot emulate.
- Audit `ar`, `fr`, `en`, RTL/LTR, accessibility, security, performance, and observability per feature.
- Never promote `Partial` or `Blocked` work to `Complete` without evidence.
