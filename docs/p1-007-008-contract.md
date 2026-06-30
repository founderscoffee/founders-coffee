# P1-007 / P1-008 — frozen contract (the seam both worktrees must respect)

> P1-007 (event list/detail) and P1-008 (RSVP + atomic capacity) are developed **in parallel
> worktrees**. They converge only on the **event-detail surface**. This doc freezes that seam so the
> two branches never conflict. **Read this before either branch starts.** P1-007a *materializes* it
> into the codebase; P1-007b and P1-008 branch off the merged P1-007a.
>
> Execution plans: [`docs/p1-007-008-plan.md`](./p1-007-008-plan.md).

---

## 1. The shared type — `EventWithAttendance`

**File:** `libs/server-fns/src/events/attendance.ts` — **created by P1-007a.**

```ts
import type { Event } from '@founders-coffee/db';

/** Attendance fields attached to an event response. P1-008 populates these. */
export interface EventAttendance {
  /** Count of RSVPs with status = 'going'. */
  readonly goingCount: number;
  /** Remaining seats. `null` ⇔ capacity === 0 (unlimited / free-form). */
  readonly remaining: number | null;
  /** The viewer's RSVP. `null` ⇔ logged-out or not RSVP'd. */
  readonly viewerRsvp: 'going' | null;
}

/**
 * During parallel dev the attendance fields are OPTIONAL (absent until P1-008).
 * P1-008's final step narrows this to `Event & EventAttendance` (required) and
 * populates them at the RPC layer. UI MUST render them defensively.
 */
export type EventWithAttendance = Event & Partial<EventAttendance>;
```

Re-export from `libs/server-fns/src/events/index.ts` **and** the main barrel so both the UI and the
rsvp module import `EventWithAttendance` / `EventAttendance` from `@founders-coffee/server-fns`.

**Consumer rule (P1-007 UI):** render attendance UI **only when the field is present** —
`{event.goingCount != null && <GoingBadge …/>}`. Until P1-008, absent → invisible. **Never assume
the field exists, never stub a fake `0`.**
> **After P1-008 merges:** the type narrows `Partial` → required, so P1-007b's `event.goingCount != null`
> guards become always-true — **redundant but harmless** (TypeScript still accepts them). They were
> defensive for the parallel period; P1-008 may tidy them or leave them as guard clauses. Not a build
> break, by design.

---

## 2. The RSVP slot — `<RsvpSection>`

**File:** `apps/ui/src/components/RsvpSection.tsx` — **created by P1-007a as a no-op** (`=> null`),
**implemented by P1-008.**

```tsx
import type { EventWithAttendance } from '@founders-coffee/server-fns';
import type { Locale } from '@founders-coffee/i18n';

export type RsvpSectionProps = {
  event: EventWithAttendance;
  locale: Locale;
};
```

P1-007a's `<EventDetail>` mounts `<RsvpSection event={event} locale={locale} />` in a **fixed
region** (below the title/meta row, above the map). P1-008 replaces the body; the **props signature
is frozen** — do not change it without amending this doc.

---

## 3. Ownership map (who may edit what, per phase)

A file has **exactly one editor per phase**. The only cross-phase handoffs are `RsvpSection.tsx`
(007a creates → 008 implements) and `attendance.ts` (007a creates optional → 008 narrows +
populates). Both are scheduled (007a lands first), so there is no live conflict.

| File / area | P1-007a | P1-007b | P1-008 |
|---|---|---|---|
| `libs/server-fns/src/events/attendance.ts` | **creates** (optional fields) | — | narrows → required + populates |
| `libs/server-fns/src/events/index.ts` (barrel) | adds attendance export | — | — |
| `libs/server-fns/src/events/rpc.ts` | — | — | wraps `getEvent`/`getUpcomingEvents` w/ `attachAttendance` |
| `libs/server-fns/src/events/resolver.ts` | — | — | — (untouched) |
| `libs/server-fns/src/rsvps/*` (new) | — | — | **creates** (resolver + rpc) |
| `libs/db/src/rsvps.ts` + schema + migration `0005` | — | — | **creates** |
| `libs/db/src/events.ts` (cursor-tie fix + `countUpcomingByCity`) | — | **edits** | — |
| `libs/server-fns/src/markets/resolver.ts` (`getCityLanding` → +events) | — | **edits** | — |
| `libs/auth/src/rbac.ts` (ensure `member` → `rsvp:*`) | — | — | **edits** (if absent) |
| `apps/ui/src/routes/$market.e.$slug.tsx` (new) | **creates** | adds JSON-LD to `head` | — |
| `apps/ui/src/components/EventDetail.tsx` | **creates** | — | — |
| `apps/ui/src/components/RsvpSection.tsx` | **creates** (no-op) | — | **implements** |
| `apps/ui/src/components/EventCard.tsx` | — | **refactors** (Event-typed) | — |
| `apps/ui/src/components/MarketLanding.tsx` / `CityLanding.tsx` | — | **edits** (real feeds + counts) | — |
| `apps/ui/src/lib/sample-events.ts` | — | **deletes** | — |

---

## 4. The one hard constraint

**P1-007 ships with attendance fields absent** → going-count, remaining-seats, and "I'm attending"
are invisible. **P1-008 lights them up.** P1-007 must not stub fake numbers (no `goingCount: 0`
literals in UI code) — absent means absent. This is what makes the two branches independent.

---

## 5. Sequencing

1. **P1-007a** lands + merges → the contract exists in the codebase. This is the branch point.
2. **P1-007b** ∥ **P1-008** in **separate worktrees**, both off merged P1-007a. No shared files.
3. **Merge order:** P1-007b first (touches nothing P1-008 owns), then P1-008 (narrows the attendance
   type + populates + ships the real `RsvpSection`).

---

## 6. Shared infrastructure already in place (don't rebuild)

- **Timezone:** `markets.timezone` (IANA, seeded: DZ/EG/SA). Format via
  `formatDate(date, locale, { timeZone: market.timezone, … })` from `@founders-coffee/i18n`
  (FR-L4 — Latin digits, cached). **Pass the market's TZ, not the viewer's.**
- **Host profile:** `getPublicProfile({ userId })` + route `/u/$userId` already exist (FR-E7, P1-004).
- **Atomic capacity pattern:** `libs/db/src/atomic.ts` documents the
  `UPDATE events SET rsvps = rsvps + 1 WHERE id = ? AND rsvps < capacity` via `db.batch()` (D1 has no
  interactive transactions). P1-008 implements against this.
- **Event RPCs:** `getEvent`, `getUpcomingEvents`, `createEvent` already exist (P1-005).
