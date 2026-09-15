# Release Strategy — Community First

| Field         | Value                                                                    |
| ------------- | ------------------------------------------------------------------------ |
| Status        | Approved                                                                 |
| Owner         | Founder / Product                                                        |
| Decision date | 2026-09-01                                                               |
| Last reviewed | 2026-09-14 — notification, migration, and deployment evidence reconciled |
| Current focus | Community-building release                                               |
| Canonical in  | [SRS](./srs.md), [plan](./implementation-plan.md)                        |

## Decision

The first founders.coffee release exists solely to build a real, durable local founder community.
The product must help people discover relevant founders and builders, meet informally at free local
events, return, and become hosts themselves.

The governing product belief is:

> If founders.coffee cannot create community density and repeat participation, no later product or
> monetization layer will succeed.

Software supports the community operation; it does not substitute for host recruitment, event
quality, trust, and consistent local participation.

## Current release scope

The community-building release includes only the capabilities needed for the free local-event loop:

- DZ, EG, and SA active market and city discovery, with initial operational focus on Algiers;
- passwordless member authentication and onboarding;
- public member and host identity;
- free café/coworking event discovery and detail;
- frictionless event creation for authenticated hosts;
- RSVP, pre-start cancellation, capacity integrity, reminders, and host notifications;
- post-event host closeout, attendance/no-show evidence, a small private attendee feedback pulse,
  and repeat-host support;
- PWA web push as the primary notification channel and email as the default fallback; SMS is
  reserved for same-day cancellation disruption;
- lightweight host trust, event moderation, safety, abuse prevention, and operational tooling;
- Arabic, French, and English, with Arabic-first RTL support;
- accessibility, performance, observability, deployment, and release verification required to run
  the community reliably.

## Explicitly outside the current release

The following remain documented future roadmap options and are not current release scope, launch
criteria, or reasons to delay the community release:

- hackathons and challenge lifecycle features;
- sponsorship products, sponsor media, attribution, reporting, and the sponsor dashboard;
- hosted-challenge fees, prize payouts, billing, and payment automation;
- talent introductions and recruiting-adjacent workflows;
- Founder Picks and the proposed project showcase;
- expansion operations outside the configured DZ/EG/SA markets;
- a separate native mobile application;
- AI features that do not directly improve the current community event loop.

Existing foundations for future capabilities may remain in the repository. They must not be
presented as launched, activated, marketed, or required for the first release.

## Gate for future work

Future product layers do not begin automatically when the software release is complete. They require:

1. the community release to be live and operationally stable;
2. Algiers to meet the documented density threshold: at least eight completed events per month for
   three consecutive months, at least three recurring hosts, and at least 60% host retention;
3. evidence of repeat participation and a healthy host loop;
4. an explicit Founder / Product decision to open the next roadmap phase.

If the community loop fails, the response is to fix or reconsider the community proposition—not to
compensate by launching sponsorship, challenges, talent, payments, or geographic expansion.

## Documentation rule

When another document describes a future architecture, requirement, or implementation plan, it does
not override this release boundary. “Planned,” “built foundation,” or an existing phase/ticket ID does
not mean “part of the current release.” The [SRS](./srs.md) defines product requirements, this decision
defines the active release boundary, and the [implementation plan](./implementation-plan.md) defines
the current sequence.

## Active execution plans

1. Complete final handoff for the [Event Creation Remediation Plan](./event-creation-remediation-plan.md).
   EC-01 through EC-10 are complete and signed off: 18/18 staging browser cases on 2026-09-03,
   production release/DNS/WAF evidence on 2026-09-04, and the authorized production creation smoke
   performed and verified on 2026-09-10.
2. EC-10 was signed off on 2026-09-10 and CO-01 approved the same day, so the
   [Community Operations and Admin Implementation Plan](./community-operations-implementation-plan.md)
   is open. CO-02 is deployed to staging and production; the latest versions are recorded in
   [deployment evidence](./deployment-evidence.md#current-operational-snapshot--2026-09-14).

**PF-03b is complete.** The five migrations `0021` through `0025` were promoted in journal order and
applied to staging and production on 2026-09-10. The migration quarantine is empty; new migrations
can proceed through the normal review and deploy gate. See the migration rows in
[deployment evidence](./deployment-evidence.md#current-operational-snapshot--2026-09-14).

**Deploy order changed by CO-02.** `apps/ui` now binds `NOTIFICATION_SCHEDULE` across scripts to a
Durable Object class defined in `apps/worker-jobs`, so worker-jobs deploys first in each
environment; a binding naming a script that does not yet define the class is rejected. There is no
data migration and nothing to roll back in D1 — the change is bindings, a cron interval and code —
but a ui deployed against a worker-jobs that lacks the class will fail to deploy rather than degrade,
which is why the order is written here rather than left to be discovered.

The second plan closes the real-world community loop through frozen RSVP eligibility, attendance,
feedback, repeat hosting, essential admin operations, trust/moderation, weekly decisions, and
truthful community-health evidence. It complements event creation and does not authorize any
post-community commercial phase.

The [Profile and Account Management Plan](./profile-account-implementation-plan.md) is a supporting
P1-004 lane approved on 2026-09-08. It removes profile residence, gives members control of optional
public details and photos, and adds full account/privacy controls. PF-03a/b and PF-05 through PF-08
have been promoted with the 2026-09-10 releases; the plan records the remaining PF work separately.
It does not replace the EC → CO execution priority. Its delivery, retention and moderation
integrations reuse the named CO owners.
