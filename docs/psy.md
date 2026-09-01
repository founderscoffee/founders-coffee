# Product psychology notes

These notes translate the founders.coffee brand into interaction guidance. They are subordinate to the SRS and describe design principles, not independent requirements.

For the [first release](./release-strategy.md), every product choice should strengthen the free local
community loop: discover, attend, return, and host. Commercial or future-product mental models must
not leak into member and host experiences.

## Core premise

The product should make informal real-world connection feel easier, not turn a café meetup into a professional event platform. Warmth, local relevance, progressive disclosure, and low coordination effort matter more than feature density or prestige signals.

## Highest-friction moments

### Authentication

The current login screen uses email OTP with conditional OAuth. Leaving the PWA to retrieve a code creates a context switch, so the UI should explain the passwordless flow clearly, preserve the intended destination, and make code entry effortless. Phone OTP exists in the backend but is not the active UI until a phone-login screen is implemented.

### Hosting

Creating an event carries social and logistical anxiety. `apps/ui` should ask for the minimum required information in a clear sequence, use useful defaults, and maintain the no-formalities tone. Hosting is an ordinary free community action; it must not look like a commercial checkout or sponsor dashboard workflow.

### Empty cities

An empty city can look abandoned. The product should frame it as an invitation to become the first host while remaining truthful that no events are scheduled.

### RSVP

RSVP and cancellation are immediate and idempotent before event start. At `startsAt`, intent freezes
so the host has a stable attendance list. Do not add a seat-hold, vow, WhatsApp confirmation, or
other secondary commitment flow. Accountability should come from clear expectations, an obvious
pre-start cancellation path, and timely notifications—not extra transactional friction.

### Reminders

PWA web push is the primary event-reminder channel and SMS is the fallback. Copy should be specific, local, and useful without manufacturing urgency. Email is reserved for authentication, billing, and explicitly email-based workflows.

## Design principles

- Use progressive disclosure where a long form would create choice paralysis.
- Prefer local city and event context over global activity counts.
- Use genuine social proof; never fabricate attendance or scarcity.
- Avoid corporate, exclusive, or prestige language.
- Keep future sponsorship absent from the community release; if later activated, disclose it and
  keep it separate from community identity.
- Make error, loading, and empty states preserve user agency.
- Test every important screen in RTL `ar` and LTR `fr` and `en`.
- Keep accessibility and keyboard operation at WCAG 2.1 AA.

## App ownership

- `apps/ui`: members, hosts, city discovery, events, profiles, and the PWA.
- `apps/dashboard`: future sponsors and commercial challenge clients; not part of the first release.
- `apps/admin`: current moderation/trust/operations; future payment confirmation stays dormant.

This ownership prevents host/community flows from inheriting the more formal mental model of a commercial dashboard.
