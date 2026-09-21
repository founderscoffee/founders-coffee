# Gate specs — turning audit findings into CI invariants

**Founders Coffee · drafted 20 Sep 2026 · revised same evening · from the production audit
(issues #14–#80)**

Seven gates exist today and none of them would have caught anything in this audit:

```
format:check · nx sync:check · typecheck · lint · test · build · public:integration-test
```

They catch syntax, types and regressions in behaviour that already has a test. Every finding in this
audit was found by a human looking at a screen. Each one below is a **class**, not an instance.

Eleven new gates follow. Each names the invariant, where it lives in this repo's actual harness, what
it would have caught, and — in this team's own idiom — **how to falsify it**, because a gate nobody
proved can fail is a gate that passes for the wrong reason.

**G7 is built and blocking** as of `179045a`; its section records what the sketch here got wrong
once it met real Arabic, which is the kind of correction the rest of these should expect too.

**The Falsify clauses are runnable.** Each built gate has a `*.mutants.mjs` beside it, and
`tools/mutants/run-mutants.mjs` applies each mutant, checks it actually reached the file, runs the
gate, checks the file is still mutated, restores it and checks the restore was byte-exact. It exists
because the first attempt at these clauses was a shell loop that reported a mutant as surviving when
the mutation had silently not applied — the same shape as the assertion G9b is about, one level up
in the tooling. A disagreeing mutant is re-run before it is believed, and two runs that disagree with
each other are reported as unstable rather than as a verdict.

A harness error is **not** retried, deliberately. It means the tool could not do its job — the edit
did not land, or something rewrote the file mid-run — and that is a thing to look at rather than
paper over. One has been seen once, during a batch of four specs run back to back, and did not
recur in three consecutive runs afterwards. It was reported as a harness error rather than as a
surviving mutant, which is the distinction the tool exists to draw.

Ordered by confidence: G5, G6, G7, G1, G9a, G10 and G11 are structural and will not flap. G2, G3b and
G4 need tuning before they can block a merge. G8 and G9b are the expensive pair and the two that
reach the post-event lifecycle.

**Revision note.** G8–G11 were added after the 19:00 closeout and feedback run (#74–#80). That batch
is why G9 exists at all: it produced the first finding in this audit where **a test already existed,
already passed, and was blind to the defect for two independent reasons**. Gates that assume absent
coverage do not catch that; only a gate about the _shape_ of the assertion does.

---

## G1 — Per-route bundle budget

**Invariant.** No route's client JavaScript exceeds its declared budget.

**Home.** New Nx target `public:bundle-budget`, in CI job 2 immediately after `build`.

**Implementation.** Read the Vite client manifest from the build output, sum each entry with its
imported chunks, compare against a checked-in `apps/ui/bundle-budgets.json`:

```json
{
  "$market.$city.host.create": { "maxKB": 3200, "note": "mapbox-gl dominates; see #17" },
  "$market.$city.e.$slug": { "maxKB": 1400 },
  "__default__": { "maxKB": 700 }
}
```

Fail with the delta and the three largest chunks, so the message names the cause:

```
public:bundle-budget FAILED
  $market.$city.host.create   4280 KB / 3200 KB budget   (+1080 KB)
    mapbox-gl-csp-DhIhBfn2.js  1656 KB
    ...
```

**Catches.** #17 — the host wizard went 3052 KB / 67 requests → 4280 KB / 77 with nothing failing.
A budget turns that into a merge-time decision: raise the number deliberately, or don't ship the
import.

**Falsify.** Add a static `import 'mapbox-gl'` to a route not budgeted for it. The gate must fail. It
must also fail on a _lowered_ budget with unchanged code, proving it reads real output rather than a
cached number.

**Cost.** Low. Pure arithmetic on build artefacts already produced.

---

## G2 — Accessibility scan on the route matrix

**Invariant.** No route returns a serious or critical `axe-core` violation in its server-rendered HTML.

**Home.** `apps/ui/integration/a11y.integration.test.ts`, using the existing harness —
`createExecutionContext` / `worker.fetch` / `waitOnExecutionContext`, exactly as
`seo.integration.test.ts` does.

**Implementation.** Fetch each route's SSR HTML through the Worker, parse with `linkedom`, run
`axe-core` against the resulting document. No browser required, so it fits the Miniflare job.

Run the matrix across all three locales — several findings were locale-specific.

**Honest limitation, state it in the test file.** SSR-only axe cannot see client state. It would have
caught #60 (no `<h1>`) and #61 (`aria-current`), but **not** #65 (dialog naming) or #48 (doubled
option names), because those exist only after hydration and interaction. Those need the `e2e` target
with `@axe-core/playwright` after opening the dialog and typing in the venue search. Two gates, not
one — do not let the cheap one create false confidence about the expensive one.

**Catches.** #39, #53, #60, #61 at SSR; #48, #65 via the e2e companion.

**Falsify.** Delete the `<h1>` from a company page — the SSR gate must fail. Remove
`aria-labelledby` from `CancelEventDialog` — the e2e gate must fail and the SSR gate must **pass**,
which is what proves the two cover different halves.

**Cost.** Medium. Expect an initial violation backlog; land it as report-only for one week, fix the
backlog, then flip to blocking.

---

## G3 — No developer strings, and place names match the catalogue

Two assertions, one gate, because both are "the rendered page shows something only a developer should
see".

### G3a — No IANA timezone identifiers in rendered output

**Invariant.** No server-rendered page contains a string matching a known IANA zone identifier.

**Implementation.** Regex the SSR body against `Intl.supportedValuesOf('timeZone')`. Precise, no
heuristics, no false positives.

**Catches.** #41 — `Africa/Algiers` printed verbatim on every event page.

**Falsify.** Render `{event.timezone}` unformatted. Gate must fail.

### G3b — Place names equal the localised name for the active locale

**Invariant.** Every rendered city or market name equals that place's name in the active locale.

**Implementation.** Data-driven, **not** a regex. For each route in the matrix, extract rendered place
names and assert membership in the locale's catalogue from `libs/domain` geo data.

**Why not "no Latin characters".** That rule would false-positive on the brand, on café names like
`Café Atlas`, and on the `Hydra 1, 16` street line — all legitimately Latin. #63 is not "Latin text
present"; it is "the romanised name used where the localised one exists". Only the catalogue check
distinguishes those.

**Catches.** #63 — `Kouinine` on both activity tabs where every other surface says `كوينين`.

**Falsify.** Swap one row to the romanised name. Gate must fail. Then render `Café Atlas` as a venue
name — the gate must **pass**, proving it is not a Latin-character rule.

**Cost.** G3a low. G3b medium — needs a catalogue accessor, but that data already exists.

---

## G4 — Numeric and bidi-sensitive content declares its direction

**Invariant.** Every element rendering a time, a time range, a numeric range or an email address
carries an explicit `dir`.

**Home.** Component-level unit tests, plus one integration assertion over the route matrix.

**Implementation.** Structural, not visual. Resolving the Unicode bidi algorithm to compare visual
order is possible but fiddly and slow; asserting that direction is _declared_ is cheap, precise and
fixes the same class. Assert `dir="ltr"` (or a `<bdi>` wrapper) on the elements in question.

**Catches.** #67 — value `18:00 - 19:00` rendering as `19:00 - 18:00` under inherited `dir="rtl"`.
#51 — the email input inheriting RTL with only `text-align` patched.

**Falsify.** Remove `dir` from the wizard's time input. Gate must fail. This is also the falsification
that proves the gate is structural: the _value_ never changed in #67, only its rendered direction, so
a value-equality test would have passed throughout.

**Cost.** Low once the element inventory is written. That inventory is the actual work.

---

## G5 — Locale contract: every route prefixed, or exempt with a reason — **BUILT**

**Invariant.** Every route in the generated tree is locale-prefixed, or carries an entry saying what
kind of exception it is and why.

**Home.** `apps/ui/src/lib/route-contract.test.ts`. This section originally said to extend
`url-contract.test.ts`; that file asserts over pure functions and runs with no I/O, and bolting a
parse of an 896-line generated file onto it would have made two unrelated concerns fail as one. The
two are complements and sit side by side: `url-contract` checks that the **helpers** produce
prefixed paths, from a hand-written list of seven; this checks the **tree**, all 39 of them, which
is the half a hand-written list cannot keep up with.

**Implementation as built.** Read `routeTree.gen.ts` as text rather than importing it — importing
pulls in every route module and everything they render, to answer a question about addresses, and
the generated file already states the answer. Pair each `fullPath` with the file it came from via
the generator's own import block, then classify:

```ts
type Kind = 'protocol' | 'redirect' | 'unresolved' | 'root';
```

`protocol` is a machine-readable file with no reader to serve a language to. `redirect` is a 307
stub for an address already sitting in somebody's inbox. `root` is `/` alone. `unresolved` is a page
that really does render in the cookie's language — a defect, not a decision.

Five assertions. The three that make the map more than a comment:

- an `unresolved` entry whose reason names no `#issue` fails, so a defect cannot be parked as a
  preference;
- an entry for a route that no longer exists fails, the same stale-exclusion rule G7 uses;
- a `redirect` entry whose route file declares a `component`, or has lost its `beforeLoad`, fails —
  a stub that grew a body stopped being a stub, and that is how `8f59f74` would come back quietly.

**Today's ledger.** 39 routes: 10 prefixed, 6 protocol, 14 redirect stubs, 1 root, and **8 open**.
The eight are `/login`, `/onboarding`, `/profile`, `/profile/`, `/profile/account`,
`/profile/activity`, `/profile/notifications` and `/u/$userId`.

**Catches.** #58 — and it found an instance the audit never named. #58 lists `/login`, `/profile/*`
and `/u/:id`; `/onboarding` is the same defect, a rendered page behind `requireSession` with no
locale in its path, and nobody had written it down. It also prevents the recurrence described in
#72.

**Falsify.** `node tools/mutants/run-mutants.mjs apps/ui/src/lib/route-contract.mutants.mjs` — seven mutants, 7/7:

| mutant                                                  | expected | got  |
| ------------------------------------------------------- | -------- | ---- |
| a new unprefixed route with no entry                    | fail     | fail |
| `/login`'s entry deleted while the route stands         | fail     | fail |
| an entry for a route that does not exist                | fail     | fail |
| an `unresolved` entry with no issue number              | fail     | fail |
| a redirect stub given a `component`                     | fail     | fail |
| a redirect stub stripped of its `beforeLoad`            | fail     | fail |
| the generated tree mangled so the parse returns nothing | fail     | fail |

The last one earns its place. With the parse empty, three of the five assertions pass **vacuously** —
there is nothing to iterate, so nothing can be wrong. Only the guard asserting the parse found
something stands between a broken reader and a green gate. Every gate in this document that reads a
generated or external file needs that assertion, and G3a, G3b, G6 and G9a all do.

**Cost.** Low, as predicted — about an hour including the mutants.

---

## G6 — No internal link answers a redirect

**Invariant.** Every internal `href` rendered by the application resolves without a 3xx, except
deliberate auth gates.

**Home.** `apps/ui/integration/link-contract.integration.test.ts`.

**Implementation.** For each route in the matrix, fetch through the Worker, extract `href="/…"`, fetch
each target through the Worker, assert the status is not 3xx. Allowlist the auth gate explicitly:

```ts
const AUTH_GATED = ['/profile', '/profile/activity', '/profile/account', '/profile/notifications'];
```

I ran this manually against production today: 51 distinct internal hrefs, and the single redirect was
`/profile/activity → /login?redirect=…`, which is `a260b2e` working correctly. That is the allowlist,
verified.

**Catches.** Makes `9a2c934`'s hand audit permanent. That commit found the footer brand on `/`, the
feedback page linking unprefixed forms, and every notification email building `/{market}/e/{slug}` —
each costing a full document load, two server calls, a 307, and a second document load.

**Falsify.** Point the footer brand mark back at `/`. Gate must fail.

**Cost.** Low. Runs entirely in Miniflare against the existing harness.

---

## G7 — Terminology lint against a glossary — **BUILT**

**Invariant.** No message in `libs/i18n/messages/*.json` uses a banned synonym for a canonical term,
unless the glossary excuses that key and says why.

**Home.** `libs/i18n/src/glossary.test.ts`, driven by a checked-in `libs/i18n/glossary.json`. It runs
in CI job 1 already — `nx run-many -t typecheck lint test` includes `i18n:test` — so there was no
wiring step. Shipped in `179045a`.

**What the first draft of this section got wrong.** It sketched a substring match. That does not
work in Arabic, and the numbers are not close. Measured on `ar.json` as it stands:

| banned as a substring | strings hit                 | actually the banned sense                                |
| --------------------- | --------------------------- | -------------------------------------------------------- |
| `قادم`                | 9, across 6 surface forms   | **3** — the rest are `القادمة` and `قادمًا`, _upcoming_  |
| `شارك`                | 18, across 11 surface forms | **2** — the rest are `مشارك` and `مشاركة`, _participant_ |

Those false positives share a root with the banned word and are not the banned word. A rule with a
67% and an 89% false-positive rate gets switched off in its first week.

**Implementation as built.** A token is normalised — harakat, tatweel, markup and placeholders
removed, alif written one way — then compared for **exact equality** after Arabic's glued-on
particles come off the front:

```ts
const PREFIXES = ['وال', 'فال', 'بال', 'كال', 'لل', 'ال', 'و', 'ف', 'ب', 'ك', 'ل'];
```

`م` is deliberately absent. It is what forms `مشارك` from `شارك`, and stripping it is precisely the
over-reach that produced those sixteen. An entry whose banned term contains a space is matched as a
phrase instead.

The entry shape carries a decision, a reason, and its own backlog:

```json
{
  "canonical": "حضور",
  "banned": ["قادم"],
  "why": "#56 — the status and its undo should share a root.",
  "allow": {
    "rsvp_already": "#56 open — still أنت قادم. Delete this line with the rename.",
    "activity_upcoming": "#56 — the Upcoming tab label. Genuine upcoming sense. Keep."
  }
}
```

`canonical: null` marks a term nobody has decided yet; the entry then has to carry a `decide` note
naming the question, and the gate does not enforce it. That is how `شارك` is recorded — _share_ on
event pages, _participate_ in the footer, both defensible Arabic, and not a call for whoever writes
the gate.

**Three of the four seeded entries are open defects, not protections.** #49 still says
`استضف جلسة عمل`, #66 still says `نشاطي` in the footer while the page it opens says `لقاءاتك`, and
#56 still says `أنت قادم`. Each sits in its entry's `allow` map with its issue number, so the gate
passes today and blocks _new_ instances while the backlog is worked off. This is the same
land-it-green-then-clear-the-backlog shape G2 and G9a need.

**The half that makes the backlog shrink** is a second test: an `allow` line whose key no longer
contains any banned term **fails**. An exclusion outlives its reason silently and re-opens the hole
it was cut for, so the person renaming a string is told to delete the excuse in the same run, by the
same failure.

**Catches.** #49, #66, #56, and the `شارك` ambiguity as a recorded open question. Writing it also
turned up a second instance of #56 the audit had missed: `ntf_push_rsvp_received_title` reads
`شخص قادم إلى {title}` — the same RSVP sense as `rsvp_already`, on the notification that reaches a
host.

**Falsify.** `node tools/mutants/run-mutants.mjs libs/i18n/src/glossary.mutants.mjs` — six mutants, 6/6:

| mutant                                               | expected | got  |
| ---------------------------------------------------- | -------- | ---- |
| `جلسة عمل` reintroduced on an unexcused key          | fail     | fail |
| `host_page_title` excuse dropped, violation standing | fail     | fail |
| that violation fixed, excuse left behind             | fail     | fail |
| a canonical term banned by its own entry             | fail     | fail |
| an undecided entry stripped of its `decide` note     | fail     | fail |
| `اللقاءات القادمة والمشاركون` added                  | **pass** | pass |

The last one is the gate's real test. Three legitimate words carrying two banned roots — the case a
substring search gets wrong.

**Cost.** Low, as predicted, and under an hour. The glossary's _content_ remains an afternoon of the
founder's judgement, and that is still the part that carries the value: the mechanism enforces a
decision, it does not make one.

---

## G8 — Lifecycle and actor preconditions are declared, not assumed

**Invariant.** Every state-changing operation has a checked-in row stating its expected outcome for
each lifecycle phase of the event and each class of actor. An operation with no row fails the build.

**Home.** `libs/server-fns/src/operations-matrix.test.ts`, driven by a table beside it. The fixtures
already exist — `closeout.test.ts:131` uses `pastEvent(db, { endedHoursAgo })`, which is exactly the
constructor this needs.

**Implementation.**

```ts
const MATRIX = {
  cancelEvent: {
    before_start: { host: 'ok',  attendee: 'event_not_host', stranger: 'event_not_host' },
    in_progress:  { host: 'ok',  attendee: 'event_not_host', stranger: 'event_not_host' },
    after_end:    { host: 'event_already_ended', ... },   // ← #74, currently 'ok'
    cancelled:    { host: 'ok (no-op)', ... },
  },
  submitFeedback: {
    after_end:    { host: 'feedback_is_host',    // ← #77, currently 'saved'
                    attendee: 'saved', non_attendee: 'not_attended' },
  },
} as const;
```

The table states the **expected outcome**, not merely that a test exists. That distinction is the
whole gate: a coverage mandate is satisfiable with a test that asserts nothing, and a table of
expected error codes is not.

**Catches.** #74 — a host cancelling a meetup that already happened, which fans cancellation notices
out to people who attended and permanently blocks the closeout, the feedback and the repeat template.
#77 — the host submitting attendee feedback on their own event.

**Falsify.** Delete the `after_end` guard from `cancelEventResolver`. Gate must fail, naming the cell.
Then add a new mutating operation with no row at all — gate must also fail, which is what stops the
table going stale.

**Cost.** High. This is the most expensive of the eleven and the only one that catches a
launch-blocker. Land `cancelEvent` and `submitFeedback` first and grow the table; a partial table that
blocks is worth more than a complete one that does not exist.

**Limitation, state it in the file.** The matrix proves the server refuses. It says nothing about
whether the UI still offers the action — #74 is a defect in both layers, and only the server half is
gateable this way. The client half belongs to G2's e2e companion or to a component test.

---

## G9 — Nothing reachable only from a test

Two assertions, one gate, because both are "code that looks tested and cannot be reached in
production".

### G9a — No export whose only consumer is its own test

**Invariant.** Every symbol exported from a `libs/*` barrel is imported by non-test code outside its
own package.

**Implementation.** `knip` (neither it nor `ts-prune` is in the repo today) with test files excluded
from the consumer set. That exclusion is the entire point and the reason a stock dead-code check does
not work here: `feedbackTally` **has** a test, a good one, and a naive unused-export scan passes it.

**Catches.** #76 — `feedbackTally` is the only aggregate over `event_feedback`, is exported, is
tested, and has no caller anywhere; `apps/admin/src` contains no feedback surface at all. Also #71 —
`PRELOAD_STALE_TIME_MS`, left with zero references after `518c334` reverted the preload window.

**Falsify.** Export an unused const — gate must fail. Now import it from a test file only: the gate
must **still** fail. A gate that goes green at that point is the gate that missed #76.

**Cost.** Low. One dev dependency and a config file. Expect a backlog; land report-only, clear it,
then block.

### G9b — A success state is proved through the real hook, in a string only it can produce

**Invariant.** Any test asserting a post-mutation success state (a) drives it through the real query
client rather than a hand-set `isSuccess` flag, and (b) asserts a string the failure branch cannot
also produce.

**Implementation.** Replace the mocked-hook pattern with a real `QueryClient` and a stubbed transport,
so `invalidateQueries` actually refetches and the component sees the state production gives it.

**Catches.** #75 — and this is the case that justifies the gate, because a test for it already exists
and passes. `CloseoutPage.test.tsx:197-214`, _"gives way to the confirmation once the retry lands"_,
is blind twice over:

- `vi.mock('../hooks')` freezes `query.data.outcome` at `null`, so the refetch that causes the bug
  cannot occur in the test at all;
- and the assertion is `toMatch(/Thank you/i)`, which matches both _"Recorded. Thank you."_ and
  _"Already closed out. Thank you."_ — so even with a real refetch it could not tell the branches
  apart.

The result is a green test over three unreachable behaviours: the receipt, the `refusedMarks`
data-loss alert, and the repeat-host link at the highest-intent moment in the product.

**Falsify.** Take today's code and today's test, swap the assertion to `/Recorded/i`, and make the
mocked query return the event's post-mutation `outcome`. The test must fail. If it still passes, the
harness is not reproducing production and the gate is not yet real.

**Cost.** Medium. The mechanical change is small; auditing which existing success assertions are
tautological is the work. Start with the ones matching on a shared word — `Thank you`, `شكرًا`, `تم`.

---

## G10 — No pending notification survives a transition that contradicts it — **BUILT**

**Invariant.** For every terminal event transition, a checked-in table names the template keys it
must retire — **and** the ones it must leave alone.

**Home.** `libs/server-fns/src/notifications/lifecycle.test.ts`, on real D1 through
`@founders-coffee/db/operations-fixtures`, no mocked bindings.

**Implementation as built.** Seed one pending row per key the transition has an opinion about, run
the transition, read the rows back by id. Seeded rather than produced: how a row got there is each
producer's business and each has its own suite, and driving five producers would make the answer
depend on five channel plans and five sets of contact preferences. Asserting by seeded id also
keeps the question clean where a transition writes new rows of the same key — cancelling retires
the pending `event_cancelled` and then enqueues its own.

**The `keeps` half is the point.** Retiring is done with `cancelNotificationsByEvent`, which takes
every pending row for the event. So a transition that also enqueues messages has to cancel before
it writes. `submitCloseoutResolver` writes the feedback invitations, and the natural fix for #80 in
the natural place — after the fan-out — would retire the ones it had just created. The mutant table
below has that exact fix in it, and the gate catches it.

**Today's ledger.** Cancelling retires `reminder_72h`, `reminder_24h`, `closeout_prompt` and
`feedback_invitation`, and that is live and enforced. Closing out must retire `closeout_prompt` and
must keep `feedback_invitation`; the keep is enforced, and the retire is parked against **#80** with
the same self-clearing rule G5 and G7 use — a parked entry that has quietly started working fails,
telling whoever fixed it to delete the line so the real assertion takes over.

**Catches.** #80.

**Falsify.** `node tools/mutants/run-mutants.mjs libs/server-fns/src/notifications/lifecycle.mutants.mjs`
— seven mutants, 7/7:

| mutant                                                      | expected | got  |
| ----------------------------------------------------------- | -------- | ---- |
| the cancel path stops retiring anything                     | fail     | fail |
| #80 fixed with an unscoped cancel, placed after the fan-out | fail     | fail |
| #80 fixed properly, with the parked entry left behind       | fail     | fail |
| a parked defect with no issue number                        | fail     | fail |
| a parked key the transition never claimed to retire         | fail     | fail |
| a transition that declares it retires nothing               | fail     | fail |
| a rename inside the cancel path that changes no behaviour   | **pass** | pass |

The last one proves specificity: the gate is not simply "any edit to `cancel.ts` fails".

**Cost.** Low. The fixtures and the DB helpers already existed.

---

## G11 — A chosen option looks chosen — **BUILT**

**Invariant.** Two parts. Every control that hides its own radio or checkbox behind `sr-only` is
listed with the test that covers it, and that test compares the **visible** markup of two different
selections.

**Home.** `apps/ui/src/lib/visible-selection.test.ts` for the discovery half,
`apps/ui/src/lib/visible-selection.ts` for the comparison helper, and the comparison itself beside
each control — today `FeedbackForm.test.tsx`.

**Why the helper strips `sr-only` before comparing.** The hidden input's `checked` changes whether
or not anything visible does, so a naive markup diff passes on the input alone. Removing the
`sr-only` subtree leaves exactly what a sighted reader has to go on. That deletion _is_ the gate;
one of the mutants below removes it and the suite must fail.

**`type="file"` is excluded deliberately.** A hidden file input behind a styled button is the
ordinary way to do that and has no selected state to render. `ProfilePhotoField` is the one in this
repo, and it is correctly out of scope.

**Today's ledger.** One control in scope, `FeedbackForm`'s rating group — and #79 is **fixed** in
the same commit rather than parked, because a gate whose only instance is parked has no live
assertion. The chosen option now takes `btn-primary` against `btn-outline`, following the ternary
pattern `CityFilters.tsx` already uses. The discovery half is what earns its keep going forward:
control number two cannot be added without a test.

**Catches.** #79 — and holds it fixed.

**Falsify.** `node tools/mutants/run-mutants.mjs apps/ui/src/lib/visible-selection.mutants.mjs`
— seven mutants, 7/7:

| mutant                                                       | expected | got  |
| ------------------------------------------------------------ | -------- | ---- |
| #79 reverted — the chosen rating styled like the others      | fail     | fail |
| only the hidden input varies, which is what #79 actually was | fail     | fail |
| a new hidden radio with nothing covering it                  | fail     | fail |
| the covering test named but not making the comparison        | fail     | fail |
| an entry for a control that no longer hides its input        | fail     | fail |
| the comparison helper made blind to the visible class        | fail     | fail |
| a styling change that still distinguishes the chosen option  | **pass** | pass |

**Limitation.** It proves a difference exists, not that the difference is legible. Contrast is G2's
territory and the two should not be confused for each other.

**Cost.** Low.

---

## Wiring

| gate                       | CI job                     | blocking from                                          |
| -------------------------- | -------------------------- | ------------------------------------------------------ |
| G5 locale contract         | job 1 (`test`)             | **live** — already in job 1                            |
| G6 link shape              | job 2 (`integration-test`) | immediately                                            |
| G7 terminology             | job 1 (`test`)             | **live** — `179045a`, already in job 1                 |
| G1 bundle budget           | job 2, after `build`       | immediately, budgets set at today's measured values    |
| G3a IANA strings           | job 2                      | immediately                                            |
| G3b place names            | job 2                      | after the catalogue accessor                           |
| G2 axe SSR                 | job 2                      | report-only one week, then blocking                    |
| G2 axe e2e                 | `e2e` target               | after the SSR backlog clears                           |
| G9a dead exports           | job 1 (`lint`)             | report-only until the backlog clears, then immediately |
| G10 notification lifecycle | job 1 (`test`)             | **live** — already in job 1                            |
| G11 selected state         | job 1 (`test`)             | **live** — already in job 1                            |
| G9b success-state shape    | job 1 (`test`)             | as each tautological assertion is rewritten            |
| G8 lifecycle matrix        | job 1 (`test`)             | `cancelEvent` and `submitFeedback` first, then grow    |

**Set G1's budgets at today's numbers, not at targets.** A budget of 4280 KB for the host wizard looks
like surrender, but it stops the next regression while #17 is scoped. A budget you have to lower on
purpose is a working gate; one you fail on day one gets disabled.

## What these still will not catch

Stated so the list is not mistaken for coverage:

- **#36**, the launch-blocker — a valid session reported as ended. That is a state-machine bug in
  error mapping. It needs a test for the specific case, not a class gate.
- **#57**, the feedback default — a deliberate-looking boolean. No gate can tell an intended default
  from an accidental one. What _is_ now findable is its consequence: G9a catches #76, and #57 + #76
  together are what make the feature dead at both ends. A gate can show you the far end of a decision
  it cannot second-guess.
- **#78**, the host panel still describing a future meetup after it ends. Half of it is G7's inverse —
  `live_window_closed` serves two opposite states, _not yet open_ and _already over_, and a glossary
  that bans two words for one thing does not catch one word for two. Worth adding as a second
  assertion there: no message key referenced from mutually exclusive branches. The other half, copy
  that is merely wrong for the moment it appears in, is not gateable.
- **#74's client half.** G8 proves the server refuses; nothing here proves the UI stopped offering
  the button. That gap is real and is where the harm actually starts.
- Anything about whether the product is _good_: #14, #15, #23, #24, #25, #26. Gates hold a line; they
  do not tell you where the line should be.

Of the seven findings from the 19:00 run, six fall inside the new gates — #74 and #77 in G8, #75 and
#76 in G9, #79 in G11, #80 in G10 — and #78 is the one that only half fits. That ratio is better than
the earlier batch's, and the reason is worth naming: post-event defects are structural rather than
visual, and structure is what CI is good at. The findings a person still has to go looking for are
the ones on a screen.

## What changed the shape of this document

The first draft assumed the gap was missing coverage. #75 disproved that. `CloseoutPage.test.tsx`
already had a test named _"gives way to the confirmation once the retry lands"_; it passed; the
behaviour it names was unreachable in production. It was blind because the hooks were mocked, so the
refetch that causes the bug could not occur, and because it asserted `/Thank you/i`, which both the
correct and the broken string satisfy.

So the useful question is not _is there a test_ but _could this test have failed_. Every gate above
carries a **Falsify** clause for that reason, and G9b makes the question itself a gate. When auditing
the existing suite, start with assertions that match on a word two branches share — `Thank you`,
`شكرًا`, `تم`, `saved`, `done`.
