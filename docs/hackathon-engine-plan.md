# Hackathon Engine — Implementation Plan

| Field | Value |
|---|---|
| Document | Hackathon Engine Plan — founders.coffee |
| Version | 1.0 |
| Status | Validated (research-backed) — ready to execute |
| Owner | Engineering |
| Last updated | 2026-06-25 |
| Derived from | [SRS v1.2](./srs.md) (FR-H1..H8, FR-P1..P4, §5.3/§5.5) · [implementation-plan.md](./implementation-plan.md) Phase P2 · [AGENTS.md](../AGENTS.md) · [sponsorship-measurement-plan.md](./sponsorship-measurement-plan.md) (SP-014) |
| Phase | P2 (expands epics P2-A…P2-F) |

> This plan specifies a **fully functional hackathon/challenge engine**: lifecycle state machines, host management (create/edit/cancel/pause), participant registration & eligibility, team formation, submissions, judging/scoring, results/leaderboard, prizes & payouts, communications, integrity/anti-abuse, and timezone handling — all on our locked Cloudflare stack. It replaces the main plan's P2 epics with executable `HACK-*` tickets.

---

## 1. Validation summary (research, 2025–2026)

| Pattern | Validated by |
|---|---|
| Lifecycle: Setup → Registration → Team Formation → Hacking → Submission → Judging → Results | [Ideawake 2026 guide](https://ideawake.com/virtual-hackathon-platform-for-companies-the-2026-high-performance-guide/); [urHackathon](https://urwave.com/products/urhackathon); [TAIKAI](https://taikai.network/); [HackerEarth guide](https://www.hackerearth.com/community-hackathons/resources/e-books/guide-to-organize-hackathon/) |
| Submission = original work; required artifacts (demo video, description, screenshots, repo) | [Devpost rules](https://hackdevpost.devpost.com/rules); [Devpost submission walkthrough](https://www.youtube.com/watch?v=SylgkOajqrY) |
| Judging: 3–4 weighted criteria, 1–5/1–10 scale, COI recusal, weighted aggregation, tie-break, calibration | [Corporate Hackathon Toolkit](https://theinnovationmode.com/hackathon-toolkit); [MLH judging plan](https://guide.mlh.io/general-information/judging-and-submissions/judging-plan); [DoraHacks](https://dev.to/dorahacks/how-to-design-a-hackathon-judging-plan-olf); [ScoreJudge](https://scorejudge.com/judging-software-for-hackathons/); [IBM template](https://www.ibm.com/community/z/advocacy/wp-content/uploads/Hackathon-Judging-Template.pdf) |
| Prizes: cash/hardware/software, multiple tracks, participation prizes | [Devpost planning strategy](https://help.devpost.team/article/290-hackathon-planning-strategy) |
| Eligibility configurable (region/age/affiliation) | [Devpost eligibility features](https://www.youtube.com/watch?v=LG2ernBAWuI) |
| Team size commonly 1–4 (up to 5–6), configurable | [GAR-LCIA (1–5)](https://www.lcia.org/News/garlcia-hackathon-2026.aspx); Devpost rules |
| AI-assisted code allowed **with human contribution**; fully-AI banned; plagiarism = DQ + forfeit | [Intellibus 2026](https://www.intellibushackathon.com/rules); [USAII 2026](https://usaii-global-ai-hackathon-2026.devpost.com/rules); [HackYeah](https://hackyeah.pl/how-to-use-ai-responsibly-at-a-hackathon/) |
| Mandatory AI-content disclosure trend (EU AI Act) | [EU AI Code of Practice](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content) |

---

## 2. Roles & permissions (RBAC for hackathons)

| Role | Scope | Capabilities |
|---|---|---|
| **Host** | a challenge | create/edit/publish/cancel/pause; configure tracks/eligibility/team limits/judging/prizes; manage announcements; invite judges; resolve disqualifications |
| **Co-host** | a challenge | same as host except billing/cancel |
| **Judge** | assigned submissions | view assigned submissions (blind), score, comment, recuse (COI) |
| **Participant** | a challenge | register (if eligible), form/join team, submit, view own results |
| **Captain** | a team | invite members, submit/edit on behalf of team, transfer captaincy |
| **Member** | a team | contribute, leave team |
| **Admin/Moderator** | market | moderate content, override/intervene, manage flags |

Every server function declares the required role + scope (challenge_id/team_id) and is checked by the shared authz middleware (AGENTS.md §7, §10). No inline checks.

---

## 3. Lifecycle state machines

### 3.1 Challenge lifecycle (driven by a Workflow, not cron)
```
draft ──publish──▶ announced ──reg_open_at──▶ registration_open
   │                                                  │
   │                                                  └─reg_close_at──▶ building
   │                                                                         │
   │                                                                         └─build_start_at/build_end_at──▶ submission_open
   │                                                                                                    │
   │                                                                                                    └─submission_deadline──▶ submission_closed
   │                                                                                                                                  │
   │                                                                                                                                  └─judging_start_at──▶ judging
   │                                                                                                                                                         │
   │                                                                                                                                                         └─judging_end_at──▶ results_published ──▶ completed
   │
   └──(cancel or pause from any active state)──▶ cancelled | paused
```
- **Workflow per challenge** (Cloudflare Workflows): created at publish; sleeps until each timestamp, performs the transition + fires notifications (AGENTS.md §11.5). No D1 polling.
- **Cancel**: host ends early → participants notified, submissions locked, fees refunded per policy. **Pause**: temporary freeze (e.g., incident); resumable.
- All timestamps **UTC**; displayed in challenge timezone.

### 3.2 Submission state
```
draft ──submit──▶ submitted ──(after deadline)──▶ late (flagged)
                                            └─(integrity violation)──▶ disqualified
                                            └─(judging complete)──▶ judged
```

### 3.3 Team state
```
forming ──min members met + build starts──▶ active ──submission/build_end──▶ locked
```

---

## 4. Detailed flows

### 4.1 Host: create / edit / publish / cancel / pause
- **Create/edit** (TanStack Form + Zod): title, slug, problem statement, rules, code of conduct, banner (R2), tracks[], eligibility {regions[], min_age, affiliations[]}, team_min/team_max, schedule (reg/build/submission/judging/results timestamps + timezone), prize pool (Money) + per-track/place prizes, judging config (criteria[], scale, weights, judges_per_submission, blind flag), AI policy, COI enabled.
- **Publish**: validates required fields; sets `announced`; launches the lifecycle Workflow.
- **Edit**: allowed while `draft`/`announced`/`registration_open` (with constraints — cannot shorten an elapsed deadline). Locked fields once a phase passes.
- **Cancel/Pause**: server-fn with reason; Workflow notified; participants/teams notified via Queue; refunds per policy (Year 1: manual Order refund).

### 4.2 Registration & eligibility (participant)
- **Register**: eligibility checked server-side (region/age/affiliation vs `Challenge.eligibility`); code-of-conduct agreement recorded; Turnstile; capacity enforced; status `registered`.
- **Withdraw**: allowed until submission; frees team slot.
- Eligibility is **enforced, not self-attested only** — where verifiable (e.g., market/city from profile), enforce; otherwise attested + flaggable for moderation.

### 4.3 Team formation
- **Create team** (becomes captain) / **join via invite link** / **request to join**.
- **Invites**: token link with expiry; accept/decline.
- **Size limits**: enforced atomically (`INSERT … WHERE team_size < team_max` via D1 batch — AGENTS.md §11/§11.5).
- **Captain transfer**, **leave team**, **kick member** (captain).
- Team locked at submission or `build_end_at`.

### 4.4 Submissions
- **Create/edit** (captain): title, description, **demo video URL**, **repo URL**, screenshots (R2), writeup (R2/PDF), select track, **AI-disclosure** (what AI was used + human contribution), optional live demo link.
- **Versioning**: edits before deadline create new version; history retained.
- **Submit**: `draft → submitted`. After `submission_deadline` → `late` (flagged; host decides admit/disqualify).
- **Deadline enforced server-side** (UTC timestamp check in the server-fn — no client trust).
- **Required artifacts**: validated per challenge config (e.g., demo video mandatory).
- **Integrity**: original-work attestation checkbox; AI-disclosure mandatory if AI used.

### 4.5 Judging
- **Rubric**: 3–4 weighted criteria (e.g., Originality, Technical Implementation, Impact, Presentation), scale (1–5 or 1–10) — set at challenge creation.
- **Judge assignment**: judges assigned a balanced load of submissions; **COI recusal** (judge flags affiliation with a team → excluded from that submission's scoring).
- **Blind mode** (optional): judges see submission without team identity until results.
- **Calibration**: judge briefing notes published before judging opens.
- **Execution**: judge UI scores each criterion + comment; autosave; `Score` rows.
- **Deadline**: judging closes at `judging_end_at`; missing scores → flagged.

### 4.6 Score aggregation & results
- **Per submission, per criterion**: average across assigned (non-recused) judges.
- **Weighted total**: `Σ(weight_c × avg_score_c)` normalized to scale.
- **Tie-break** (deterministic, configured): (1) highest-weight criterion, (2) highest single-criterion score, (3) most first-place criterion wins, (4) host decision (logged).
- **Ranking**: overall + per track → `ScoreAggregation`.
- **Results published** at `results_at` → leaderboard visible; `PrizeWinner` rows created for top per place/track.

### 4.7 Prizes & payouts
- **Prize config**: per place (1st/2nd/3rd) and/or per track; `Prize` rows with `Money`.
- **Winner declaration**: at results, top-ranked submissions per prize → `PrizeWinner`.
- **Payout (Year 1 manual)**: creates a payout `Order` → admin confirms via BaridiMob/bank in `apps/admin` (libs/payments `ManualProvider`, FR-M5). P4 automates.
- **Receipt/certificate**: Browser Rendering PDF → R2 → Cloudflare Email.

### 4.8 Communication
- **Announcements**: host posts (pinned, emailed to participants via Queue).
- **Q&A thread** per challenge (optional): participants ask, host/judges answer; moderated.

### 4.9 Notifications & reminders (DO alarms + Workflow)
- Registration open, deadline approaching (24h/1h), judging assigned/due, results published, prize payout status — all via Queues → Cloudflare Email, triggered by the lifecycle Workflow + DO alarms (no D1 polling).

---

## 5. Integrity & anti-abuse

- **Original work attestation** + **AI-disclosure** mandatory (2025–26 standard: AI-assisted allowed with human contribution; fully-AI banned).
- **Plagiarism/integrity reporting**: participant/flag → moderation queue → host/admin reviews evidence → `Disqualification` (with reason + evidence), which sets submission `disqualified` and forfeits prizes.
- **Honest limit**: full plagiarism detection requires an external service; Workers AI provides **embedding-similarity heuristics** within the challenge's submissions + flagging for human review — **not** a definitive scan. Disclosed as human-assisted moderation.
- **Turnstile** on register/submit/team-join. **Rate-limit** (DO + WAF) on write endpoints.
- **Code of conduct** agreement recorded at registration; violations → disqualification workflow.
- **Eligibility** enforced server-side; spoofable attestations flaggable.

---

## 6. Architecture & Cloudflare service mapping

| Service | Role |
|---|---|
| **D1 (Drizzle)** | All relational entities (§7) + migrations |
| **Workflows** | **Lifecycle orchestration** — one Workflow per challenge drives phase transitions at scheduled timestamps + fires notifications (AGENTS.md §11.5) |
| **Durable Objects** | Live leaderboard (real-time standings at results); team-formation coordination locks if needed |
| **Queues** | Notifications (reg/deadline/judging/results/payout); async AI moderation/embedding |
| **R2 + Images** | Submission attachments (screenshots, writeup, demo upload), banners, certificates |
| **Workers AI** | Submission/problem-statement moderation; embedding-similarity plagiarism heuristics; AI-disclosure flagging |
| **Vectorize** | Semantic search over challenges |
| **Browser Rendering** | Certificates + result posters (PDF) |
| **Cloudflare Email** | Notifications + certificate delivery |
| **KV** | Hot challenge-config cache; leaderboard cache |
| **Analytics Engine** | Participation metrics (ties to [sponsorship plan SP-014](./sponsorship-measurement-plan.md)) |
| **Turnstile** | Register / submit / team-join |
| **libs/payments** | Hosted-challenge fee `Order` (collection) + prize payouts (manual Year 1 → P4 automated) |

---

## 7. Data model (Drizzle, `libs/db`)

```
Challenge
  id, market_id, host_user_id?, sponsor_id?, title, slug, problem_statement, rules, code_of_conduct
  banner_r2_key, status, visibility
  tracks[] (embedded), eligibility {regions[], min_age, affiliations[]}
  team_min, team_max
  reg_open_at, reg_close_at, build_start_at, build_end_at, submission_deadline
  judging_start_at, judging_end_at, results_at, timezone (IANA)
  prize_pool (Money), is_free_hosted, order_id (fee)
  ai_policy, coi_enabled, blind_judging
  judging_config { criteria[{name, description, weight, scale_min, scale_max}], judges_per_submission }
  capacity?, created_at

ChallengeTrack        // optional multi-track
  id, challenge_id, name, prize (Money)

Participant
  id, challenge_id, user_id, status (registered|withdrawn|disqualified), registered_at, coc_accepted_at

Team
  id, challenge_id, name, captain_user_id, status (forming|active|locked), created_at

TeamMember
  team_id, user_id, role (captain|member), status (invited|accepted|declined), joined_at

TeamInvite
  id, team_id, invitee_contact, token, status, expires_at

Submission
  id, challenge_id, team_id, track_id?, title, description
  demo_video_url, repo_url, writeup_r2_key, screenshots[], ai_disclosure, live_demo_url?
  status (draft|submitted|late|disqualified|judged), submitted_at, version
  original_work_attested (bool)

Judge
  id, challenge_id, user_id, status, assigned_count, briefing_accepted_at

JudgeAssignment
  judge_id, submission_id, coi_recused (bool), recusal_reason?

JudgingCriterion       // denormalized snapshot from challenge config for querying
  id, challenge_id, name, description, weight, scale_min, scale_max

Score
  id, submission_id, judge_id, criterion_id, value, comment, created_at

ScoreAggregation
  submission_id, total_weighted, rank, track_rank, computed_at

Prize
  id, challenge_id, track_id?, place, amount (Money), label

PrizeWinner
  prize_id, submission_id, team_id, payout_order_id?, declared_at

Announcement
  id, challenge_id, title, body, pinned, published_at

ChallengeMessage       // optional Q&A
  id, challenge_id, author_user_id, parent_id?, body, created_at, hidden?

Disqualification
  id, challenge_id, submission_id?/team_id?/participant_id?, reason, evidence_r2_key?, decided_by_user_id, at

Certificate
  id, challenge_id, submission_id?/participant_id?, type (winner|participant|judge), pdf_r2_key, issued_at
```

**Money rule (AGENTS.md §6):** `prize_pool`, `Prize.amount`, payouts = `{ amount_minor, currency }`.

---

## 8. Timezone & deadline handling

- **All timestamps stored UTC.** `Challenge.timezone` (IANA, e.g., `Africa/Algiers`) drives display via `libs/i18n`.
- **Deadlines enforced server-side** in UTC inside server functions — the client clock is never trusted (prevents late-submit exploits).
- The lifecycle Workflow transitions on UTC timestamps; participant-facing reminders show local time.

---

## 9. Tickets (Phase P2)

`HACK-*` IDs. Dependencies reference main-plan P0 tickets unless noted.

| ID | Title | Deps | Implements | Services | Size |
|---|---|---|---|---|---|
| **HACK-001** | `libs/domain/challenges` + `libs/db` schema (all §7 entities) + migrations + atomic helpers (team-join, capacity) | P0-006 | FR-H1..H8, §7 | D1 | L |
| **HACK-002** | **Lifecycle Workflow**: per-challenge durable phase transitions at scheduled timestamps + notification triggers; cancel/pause handling | HACK-001, P0-018 | §3.1, §4.9 | Workflows, Queues | L |
| **HACK-003** | Host: **create/edit/publish/cancel/pause** (TanStack Form + Zod): tracks, eligibility, team limits, schedule+timezone, prizes, judging config, AI policy | HACK-001, P0-010 | FR-H1, §4.1 | D1, R2 | L |
| **HACK-004** | **Registration & eligibility**: join/withdraw, server-side eligibility enforcement, CoC agreement, Turnstile, capacity | HACK-001, P0-008 | FR-H3, §4.2 | D1, Turnstile | M |
| **HACK-005** | **Team formation**: create/join/invite-link/accept/decline/leave/captain-transfer; atomic size-limit enforcement | HACK-001 | FR-H3, §4.3 | D1 (atomic batch) | M |
| **HACK-006** | **Submissions**: create/edit/version/delete; required artifacts; AI-disclosure + original-work attestation; **server-side UTC deadline**; late flag | HACK-001, HACK-005 | FR-H3, §4.4 | D1 | L |
| **HACK-007** | Submission **attachments** (screenshots/writeup/demo) → R2 + Images transforms | HACK-006, P0-011 | §4.4, §6 | R2, Images | M |
| **HACK-008** | **Judging setup**: rubric (3–4 weighted criteria + scale), judge assignment + load balance, COI recusal, blind mode, calibration notes | HACK-001 | FR-H4, §4.5 | D1 | M |
| **HACK-009** | **Judging execution**: judge UI (score per criterion + comment, autosave, recuse); deadline | HACK-008 | FR-H4, §4.5 | D1 | M |
| **HACK-010** | **Score aggregation**: weighted average (excludes COI recusals), multi-judge averaging, deterministic tie-break → `ScoreAggregation` | HACK-009 | FR-H4/H5, §4.6 | D1, Queues | M |
| **HACK-011** | **Results & leaderboard**: overall + per-track ranking, winner declaration, **live leaderboard DO** at results | HACK-010 | FR-H5, §4.6 | Durable Object, KV | M |
| **HACK-012** | **Prizes & payouts**: prize config per place/track; winner→`PrizeWinner`; payout `Order` (manual Year 1 via `ManualProvider`); PDF receipt | HACK-011, P0-015 | FR-H6, FR-M5, §4.7 | D1, libs/payments, Browser Rendering | M |
| **HACK-013** | **Announcements + Q&A**: host announcements (pinned + emailed); optional Q&A thread; moderation | HACK-001, P0-016 | §4.8 | D1, Queues, Email | M |
| **HACK-014** | **Notifications & reminders**: reg-open/deadline(24h/1h)/judging-due/results/payout via DO alarms + Workflow → Queues → Email | HACK-002, P0-016 | FR-E8/FR-N1, §4.9 | DO Alarms, Queues, Email | M |
| **HACK-015** | **Integrity & anti-abuse**: plagiarism/AI-policy reporting + `Disqualification` workflow (evidence to R2); Turnstile + rate-limits on actions; CoC enforcement | HACK-006, P0-008 | §5 | D1, R2, Turnstile, DO | M |
| **HACK-016** | **Search + moderation**: Vectorize over challenges; Workers AI moderation of problem statements/submissions + AI-disclosure flagging (human-assisted) | HACK-001, P0-017 | §5, §6 | Vectorize, Workers AI, Queues | M |
| **HACK-017** | **Certificates**: Browser Rendering PDF (winner/participant/judge) → R2 → Email | HACK-011, P0-016 | §4.7, §6 | Browser Rendering, R2, Email | S |
| **HACK-018** | **Admin/dashboard surfaces**: TanStack Table management (challenges, participants, submissions, disqualifications); sponsor attachment → [SP-014](./sponsorship-measurement-plan.md) | HACK-011, P0-010 | FR-H7, FR-M1/M2 | TanStack Table, D1 | M |
| **HACK-019** | **RBAC for hackathons**: roles (§2) + authz on every server-fn (role + scope: challenge/team) | HACK-001, P0-008 | NFR-4 | D1 | M |
| **HACK-020** | **Tests (Miniflare) + e2e**: full flow create→register→team→submit→judge→results→payout; Workflow lifecycle; no platform mocks | HACK-012, P0-021 | NFR-11 | Miniflare, Playwright | L |
| **HACK-021** | **Observability**: participation metrics (Analytics Engine), judging progress, payout-reconciliation backlog + alerts | HACK-010 | NFR-7 | Analytics Engine | S |

**Exit criteria:** a host can create & publish a challenge → participants register & form teams → submit (deadline-enforced) → judges score (with COI/blind) → aggregation ranks winners → prizes declared → manual payout completed → certificates issued — feature-flagged per market, with full integrity/anti-abuse and e2e green.

---

## 10. Dependencies & gating

- **Requires (P0):** P0-006 (db), P0-008 (auth/RBAC), P0-010 (ui), P0-011 (infra), P0-015 (payments), P0-016 (email), P0-017 (ai), P0-018 (worker-jobs), P0-021 (test harness).
- **Requires (P1):** events engine live — challenges need community density to have participants (SRS §2.2 gate: `active` market + hackathons flag + first challenge instrumented).
- **Feeds:** [sponsorship-measurement-plan.md SP-014](./sponsorship-measurement-plan.md) (sponsored-challenge attribution) and the talent pipeline (P3-C).
- **Feature-flagged** per market (`feature_flags.hackathons`); disabled where a market isn't `active` or payments aren't available.

---

## 11. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Cold-start**: no participants without community density | High | Density gate (§10); first challenge instrumented as demand signal; seed via partner/community hosts |
| **Judging integrity** (bias, COI, fatigue) | High | 3–4 criteria only; COI recusal; blind mode; calibration; multi-judge averaging; deterministic tie-break (§4.5/4.6) |
| **Deadline/timezone bugs** (late submits, wrong phase) | High | Server-side UTC enforcement; Workflow-driven transitions; never trust client clock (§8) |
| **Plagiarism/AI abuse** | Medium | Mandatory disclosure + attestation; Workers AI heuristics + human moderation; DQ workflow (§5) — honest about detection limits |
| **Payout regulatory** (prize money) | Medium | Year 1 manual (BaridiMob/bank) limits exposure; P4 automation behind compliance (NFR-6) |
| **Workflow cost/complexity** (one per challenge) | Low-Med | Workflows are cheap; idle-sleep between phases; monitor |
| **Live leaderboard DO consistency** | Low | DO single-writer for rankings; D1 source of truth |
| **Host abuse** (fake challenge, prize non-payment) | Medium | Host verification (FR-M3); payouts flow through platform Order (admin-confirmed), never host-direct |

---

## 12. What this delivers

A **complete, production-grade hackathon engine**: configurable by any host, fully lifecycle-driven (no cron polling), fair judging with COI/blind/calibration, integrity controls aligned with 2025–2026 AI/plagiarism norms, manual prize payouts (Year 1) with a clean P4 automation path, certificates, search, and full observability — all on the locked Cloudflare stack and consistent with AGENTS.md.
