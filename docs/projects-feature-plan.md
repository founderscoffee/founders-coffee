# Projects — Idea Validation & Community Showcase Feature

**A free-form project showcase where founders share what they're building, get structured community feedback, attract sponsor interest, and organically evolve ideas into challenges.**

This feature fills the missing connective tissue between events ("I met someone") and challenges ("Let's build something together") — giving founders a place to say **"Here's what I'm working on — what do you think?"**

---

## User Review Required

> [!IMPORTANT]
> This is **new scope** — no existing `FR-*` requirement covers a standalone project showcase. The SRS (FR-P1/FR-P2) frames idea validation as a *use case of paid hosted challenges*, not as a free community feature. This proposal creates a **free layer** that complements (and feeds into) the paid challenge pipeline.

> [!WARNING]
> **Phase placement decision needed.** The research recommends **P2.5 or P3** — after the hackathon engine but before/alongside sponsorship management. Inserting this into P1 or early P2 would delay the events and hackathon engines. See the [Phase Placement](#phase-placement) section below.

---

## Open Questions

> [!IMPORTANT]
> **Q1 — Feedback visibility:** Should structured feedback (guided questions) be public (everyone sees all answers) or semi-private (only the project owner sees individual responses, community sees aggregated scores)?

> [!IMPORTANT]
> **Q2 — Sponsor "Express Interest" flow:** When a sponsor expresses interest in a project, should this trigger a notification to the founder with the sponsor's identity? Or should it be anonymized until the founder opts in (aligned with the existing "warm introductions" model in FR-P4)?

> [!NOTE]
> **Q3 — Project updates:** Should founders be able to post updates/progress logs on their projects (like a build log), or keep it as a single static showcase page that can be edited?

---

## How It Fits the founders.coffee Model

```
┌─────────────────────────────────────────────────────────────┐
│                    The founders.coffee Funnel                │
│                                                             │
│  ☕ Events (P1)         "I met someone interesting"         │
│       │                                                     │
│       ▼                                                     │
│  💡 Projects (NEW)      "Here's what I'm building"          │
│       │         ╲                                           │
│       │          ╲──→ 🤝 Sponsor Interest (P3)              │
│       ▼                  "We want to support this"          │
│  🏆 Challenges (P2)    "Let's build it together"            │
│       │                                                     │
│       ▼                                                     │
│  🎯 Talent Pipeline    "Warm intro to this builder"         │
│       (P3)                                                  │
└─────────────────────────────────────────────────────────────┘
```

**Brand alignment:**
- ✅ **"Founders never pay"** — posting a project is free, always
- ✅ **"No formalities"** — structured but informal (not a pitch deck)
- ✅ **"Community adds value; is not mined"** — feedback is organic, never transactional
- ✅ **B2B revenue preserved** — sponsors pay for visibility into community signals, not founders

---

## Proposed Functional Requirements

New FR IDs use `FR-PJ*` prefix to avoid collision with `FR-P*` (talent pipeline).

### Core Project CRUD

- **FR-PJ1** Any authenticated user shall be able to **create a project** with: title, one-line tagline, problem statement, proposed solution, current stage (enum: `idea`, `prototype`, `mvp`, `launched`), what feedback they're seeking (free text), optional links (repo, demo, landing page), optional media (images/screenshots via R2), tags/categories, spoken language.
- **FR-PJ2** A project shall be **scoped to a market** (`market_id`) and optionally to a city (`city_id`). Projects are discoverable within their market.
- **FR-PJ3** A project shall have a **status machine**: `draft → published → archived`. Only `published` projects are publicly visible. Owners can archive/unarchive.
- **FR-PJ4** A project shall have a unique, human-readable **slug** (per market) for shareable URLs: `/{market}/projects/{slug}`.
- **FR-PJ5** A project shall display the **owner's public profile** (linked to FR-E7 host profile / existing public profile at `/u/$userId`).

### Structured Feedback & Reactions

- **FR-PJ6** Community members shall be able to **react** to a project using predefined reactions: 👍 (would use), 🔥 (exciting), 💡 (creative), 🎯 (solves a real problem), 🤔 (needs refinement). One reaction per user per project (changeable).
- **FR-PJ7** Community members shall be able to provide **structured feedback** via guided questions. The project owner selects 1–3 feedback questions from a predefined set when creating the project:
  - "What problem does this solve for you?"
  - "Would you use this? Why or why not?"
  - "What's the biggest risk you see?"
  - "Who do you think the ideal user is?"
  - "What feature would you add first?"
  - "How does this compare to existing solutions?"
  - Custom question (owner-defined, max 1)
- **FR-PJ8** Feedback responses shall be **public** (visible to all community members on the project page). Each user can submit one feedback response per project (editable).
- **FR-PJ9** The project page shall display **aggregated reaction counts** and a **feedback feed** (newest first, with author attribution).

### Sponsor Engagement

- **FR-PJ10** Sponsors (role: `sponsor_contact`) shall be able to **bookmark** projects they're interested in. Bookmarks are private to the sponsor.
- **FR-PJ11** Sponsors shall be able to **express interest** in a project, which sends a notification to the project owner: "{Sponsor name} is interested in your project." The founder can then opt-in to a warm introduction (aligned with FR-P4).
- **FR-PJ12** The sponsor dashboard (`apps/dashboard`) shall surface a **"Trending Projects"** feed: projects ranked by recent engagement (reactions + feedback count), filterable by market, city, stage, and category.
- **FR-PJ13** Sponsor interest data shall be available as a metric in the sponsor dashboard (FR-S4): "Projects bookmarked", "Interests expressed", "Intros accepted."

### Cross-Feature Linkage

- **FR-PJ14** A project shall be **linkable to an event**: the owner can attach their project to an event they're hosting or attending, surfacing it as "Projects being discussed at this event." The event page shows linked projects; the project page shows linked events.
- **FR-PJ15** A project shall be **evolvable into a challenge**: the owner can initiate a challenge from their project (pre-filling challenge fields from project data). The challenge page links back to the originating project. This requires the challenge engine (P2) to be active.
- **FR-PJ16** A user's public profile shall display their **projects** alongside their hosted events (extending FR-E7).

### Discovery & Browsing

- **FR-PJ17** Each market landing page shall include a **"Projects" section** showing recent/trending projects.
- **FR-PJ18** Each city landing page shall show projects from that city (if any), with the same "be the first" empty-state pattern as events (FR-E6): "Share the first project from {city}."
- **FR-PJ19** Projects shall be **searchable and filterable** by: stage, category/tags, market, city, recency, engagement (most reacted/discussed).
- **FR-PJ20** A dedicated **projects listing page** at `/{market}/projects` shall serve as the main discovery surface.

### Moderation & Safety

- **FR-PJ21** Projects shall be subject to the same **content moderation** rules as events (FR-M2): language/region-aware, admin-actionable.
- **FR-PJ22** Feedback/reactions shall be **rate-limited** (Durable Object + WAF) and **Turnstile-protected** to prevent abuse.

---

## Phase Placement

**Recommended: P2.5 (parallel with late P2, before P3)**

| Consideration | Rationale |
|---|---|
| **Why not P1?** | P1 is the events engine that ships live — adding Projects would delay the critical first launch |
| **Why not early P2?** | P2 is the hackathon engine, already fully specified (HACK-001 through HACK-021). Don't disrupt it |
| **Why P2.5?** | Projects are structurally simpler than challenges (no teams, judging, prizes). They can be built in parallel with late P2. The challenge linkage (FR-PJ15) needs P2 but can be deferred |
| **Before P3** | Projects create the engagement data that sponsors consume (FR-PJ12/13). Building Projects before the sponsor dashboard (P3) means the dashboard launches with real data |

**Suggested ticket range:** `PJ-001` through `PJ-012` (estimated)

---

## Proposed Data Model

### New Tables

```
projects
├── id                  TEXT PK (id('prj'))
├── ownerId             TEXT FK → user.id
├── marketCode          TEXT FK → markets.code
├── stateCode           TEXT (geo state, nullable)
├── cityCode            TEXT (geo city, nullable)
├── title               TEXT NOT NULL
├── tagline             TEXT NOT NULL (one-liner)
├── problem             TEXT NOT NULL
├── solution            TEXT NOT NULL
├── stage               TEXT NOT NULL (idea | prototype | mvp | launched)
├── feedbackAsk         TEXT (what feedback they want — free text)
├── feedbackQuestions    TEXT (JSON array of selected question keys)
├── links               TEXT (JSON: {repo?, demo?, website?, other?})
├── tags                TEXT (JSON array of tag strings)
├── language            TEXT NOT NULL (content language)
├── slug                TEXT NOT NULL (unique per market)
├── status              TEXT NOT NULL DEFAULT 'draft' (draft | published | archived)
├── reactionCounts      TEXT (JSON: {thumbsUp: 0, fire: 0, ...} — denormalized)
├── feedbackCount       INTEGER DEFAULT 0 (denormalized)
├── createdAt           INTEGER DEFAULT unixepoch()
└── updatedAt           INTEGER DEFAULT unixepoch()

project_reactions
├── id                  TEXT PK (id('prc'))
├── projectId           TEXT FK → projects.id
├── userId              TEXT FK → user.id
├── reaction            TEXT NOT NULL (thumbs_up | fire | creative | bullseye | thinking)
├── createdAt           INTEGER DEFAULT unixepoch()
└── UNIQUE(projectId, userId)

project_feedback
├── id                  TEXT PK (id('pfb'))
├── projectId           TEXT FK → projects.id
├── userId              TEXT FK → user.id
├── questionKey         TEXT NOT NULL (which question they're answering)
├── response            TEXT NOT NULL
├── createdAt           INTEGER DEFAULT unixepoch()
├── updatedAt           INTEGER DEFAULT unixepoch()
└── UNIQUE(projectId, userId, questionKey)

project_event_links
├── id                  TEXT PK (id('pel'))
├── projectId           TEXT FK → projects.id
├── eventId             TEXT FK → events.id
├── createdAt           INTEGER DEFAULT unixepoch()
└── UNIQUE(projectId, eventId)

sponsor_project_bookmarks
├── id                  TEXT PK (id('spb'))
├── sponsorUserId       TEXT FK → user.id
├── projectId           TEXT FK → projects.id
├── createdAt           INTEGER DEFAULT unixepoch()
└── UNIQUE(sponsorUserId, projectId)

sponsor_project_interests
├── id                  TEXT PK (id('spi'))
├── sponsorUserId       TEXT FK → user.id
├── projectId           TEXT FK → projects.id
├── status              TEXT NOT NULL DEFAULT 'expressed' (expressed | intro_requested | intro_completed)
├── createdAt           INTEGER DEFAULT unixepoch()
└── UNIQUE(sponsorUserId, projectId)
```

### Domain Module: `libs/domain/src/projects/`

```
projects/
├── status.ts           # Status machine: draft → published → archived (+ unarchive)
├── reactions.ts        # Reaction types, validation, aggregation logic
├── feedback.ts         # Feedback question catalog, validation
├── schemas.ts          # Zod schemas: createProjectSchema, updateProjectSchema, feedbackSchema, etc.
└── index.ts
```

### Server Functions: `libs/server-fns/src/projects/`

```
projects/
├── resolver.ts         # createProject, updateProject, archiveProject, getProject, listProjects
├── rpc.ts              # createServerFn wrappers with auth/validation
├── reactions.ts        # addReaction, removeReaction
├── feedback.ts         # submitFeedback, updateFeedback
├── sponsor.ts          # bookmarkProject, expressInterest
└── index.ts
```

### Feature Directories

```
apps/ui/src/features/projects/
├── api.ts
├── hooks.ts
├── types.ts
└── components/
    ├── ProjectCard.tsx
    ├── ProjectDetail.tsx
    ├── ProjectCreateForm.tsx
    ├── ProjectEditForm.tsx
    ├── ProjectList.tsx
    ├── ProjectReactions.tsx
    ├── ProjectFeedback.tsx
    ├── ProjectFeedbackForm.tsx
    ├── ProjectEventLinks.tsx
    └── ProjectEmptyState.tsx

apps/dashboard/src/features/projects/
├── api.ts
├── hooks.ts
└── components/
    ├── TrendingProjects.tsx
    ├── ProjectBookmarks.tsx
    └── SponsorInterestPanel.tsx
```

### Routes

```
apps/ui/src/routes/
├── $market.projects.tsx           # Projects listing page (FR-PJ20)
├── $market.projects.$slug.tsx     # Project detail page (FR-PJ4)
└── projects.create.tsx            # Project creation page (FR-PJ1)

apps/dashboard/src/routes/
└── projects.tsx                   # Sponsor trending projects view (FR-PJ12)
```

---

## Verification Plan

### Automated Tests

```bash
# Domain logic (pure — status machine, reactions, feedback validation)
npx nx test domain --testPathPattern=projects

# Server functions (Vitest + Miniflare — real D1)
npx nx test server-fns --testPathPattern=projects

# E2E (Playwright — full flow)
npx nx e2e ui-e2e --grep="projects"
```

**Key test scenarios:**
- Create project → publish → verify visibility on market/city pages
- Submit reaction → verify count aggregation (atomic SQL)
- Submit structured feedback → verify display on project page
- Sponsor bookmark + express interest → verify notification to founder
- Link project to event → verify bidirectional display
- Evolve project into challenge → verify pre-fill + back-link
- Rate limiting on reactions/feedback
- Turnstile verification on project creation
- Market scoping: project in DZ not visible in MA listing

### Manual Verification
- RTL layout verification (ar-DZ locale) for all project pages
- Empty-state UX: city with no projects shows "Share the first project" CTA
- Mobile PWA: project creation form usability on small screens
- Sponsor dashboard: trending projects feed with real engagement data
