# Profile UI/UX — Round Table, 2026

| Field          | Value                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status         | Design contract and interactive prototype; PF-04 through PF-08 production work is implemented incrementally, with the embedded preview superseded |
| Date           | 2026-09-08; reviewed 2026-09-14                                                                                                                   |
| Delivery owner | PF-04/05/06/07/08/11 in the [profile/account plan](./profile-account-implementation-plan.md)                                                      |
| Identity       | Existing Round Table theme in `libs/ui/src/styles.css`                                                                                            |
| Prototype      | [Source](./design/profile/index.html), Arabic default with French and English controls                                                            |
| Purpose        | Make introductions feel welcoming and account management feel clear, private and dependable                                                       |

## 1. Design direction

**Your place at the table.** The profile feels like a considered introduction to a small community:
warm paper, generous typography, a quiet navigation rail and a personal card that shows exactly
what a visitor will see. The design uses the existing roast/clay palette and round-table mark.
Optional enrichment never becomes a progress score, status competition or signup obligation.

Premium quality comes from hierarchy, spacing, consistent controls, thoughtful language and a
predictable response to every action. The user can understand the page without learning a settings
system or hunting for a save button. Location, email, phone and private attendance do not become
decorations on the public identity card.

### What current design research contributes

These are selected influences, not a claim that every fashionable pattern is useful for this product.

| Reference                                                                                                         | Evidence                                                                                                               | Application to founders.coffee                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Apple WWDC26 design guidance](https://developer.apple.com/wwdc26/guides/design/)                                 | The 2026 guidance emphasizes content focus, readability, consistency, accessibility and adaptation across screen sizes | Give the introduction visual priority; adapt secondary preview/navigation to available space; keep essential controls readable                       |
| [Google Material 3 Expressive research](https://design.google/library/expressive-material-design-google-research) | Google describes using shape, size, color, motion and grouping to convey function and draw attention to key actions    | Distinctive display typography, softly contained sections, selected topic chips and one strong save action; retain our own brand and component stack |
| [NN/g progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)                           | Long-standing guidance separates common actions from secondary complexity                                              | Profile editing comes first; contacts, sessions and destructive workflows live in their relevant account sections                                    |

The visual judgments here are our application of those principles. They are not measured conversion
claims or evidence that the founders.coffee audience has already validated this design. Apple's glass
material belongs to its platform context; this web profile retains the solid, readable surfaces
specified by Round Table. No new native visual framework, UI kit or dependency is introduced.

## 2. Screen hierarchy

### Desktop, 1120px and wider

The page uses a maximum 1240px outer composition with 32px inline padding. The 184px navigation rail
and content area are separated by 48px. The content area holds the editor and a 268px preview, with
a 28px gap. The layout follows writing direction: navigation at inline-start, preview at inline-end.

```text
Brand                                                  Interface language
──────────────────────────────────────────────────────────────────────────
Your profile        YOUR PLACE AT THE TABLE
Your gatherings     A little about you.
Preferences         An introduction. A few shared interests.
Account & security
                    ┌────────────────────────┐  Public preview
Your private        │ The introduction       │  ┌───────────────────────┐
space               │ Photo • Display name   │  │ Round-table detail    │
                    │ Short introduction     │  │ Initials / photo      │
                    │ Optional detail controls │  │ Name                  │
                    └────────────────────────┘  │ Shared details only   │
                    ┌────────────────────────┐  └───────────────────────┘
                    │ Find common ground     │  Privacy reassurance
                    │ Role • Topics          │
                    │ Languages • Link       │
                    └────────────────────────┘
                    Saved / unsaved state        Discard   Save changes
```

The embedded preview shown above belongs to the initial prototype. PF-04 removed it from the
production editor; the public profile route remains the source of truth. Private contact or account
information never appears on that public route, even for the owner.

### Tablet and mobile

- The initial prototype's mobile preview dialog is superseded by PF-04. Production links to the
  standalone public profile route instead of duplicating an editor preview or creating nested scrolling.
- Below 700px, section navigation is a two-column set of four readable controls above the heading. There is no horizontally clipped tab strip; long French and Arabic labels fit.
- Content becomes one column with 20px page gutters and approximately 18px card padding. Fields remain at least 44px tall; topic choices use 44px targets on mobile.
- A solid bottom save area shows state, Discard and Save changes, includes the device safe area, and stays clear of form content. Production implementation must verify the real virtual keyboard and zoom, not just viewport emulation.
- The prototype's public-preview dialog had a clear title, native modal focus behavior, Escape/Close
  and focus return. It is retained here as historical interaction research; production uses the
  standalone profile route. Arabic mirrors layout through logical CSS properties; user-authored text
  keeps its own `dir="auto"` and authored language.

## 3. Visual system

| Element           | Design contract                                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Surfaces          | Shared `base-100` paper; `base-200` linen for active navigation, initials and quiet supporting cards                                  |
| Text              | `base-content` for headings/main text; `neutral` for descriptions; `accent` for clay-colored readable text                            |
| Borders           | One shared `base-300` boundary; avoid borders inside borders except where field affordance requires them                              |
| Primary action    | Roast button, solid fill, clear verb; disabled state cannot be mistaken for a saved confirmation                                      |
| Typography        | Existing Outfit/Inter and Tajawal; proposal heading 32–48px, section 20–24px; Arabic gets natural line-height and no Latin tracking   |
| Production tokens | Express final scale and spacing through shared theme/Tailwind tokens; do not copy prototype CSS as an independent app theme           |
| Shape             | Existing 12px card and 8px field radii; circles for identity and the round-table motif; pills for topic choices                       |
| Density           | Two meaningful profile groups; consistent vertical rhythm; explain a field once and place optional-detail visibility beside it        |
| Motion            | Existing 120/200/320ms tokens for relevant transitions; motion respects reduced-motion; no animated background or auto-moving content |
| Icons             | Small consistent stroke icons supporting labels; icon-only controls need accessible names; retain the current brand asset             |
| Photography       | Optional; initials are a deliberate first-class state. No stock person, fake verification badge or upload-completion pressure         |
| Theme             | Light Round Table. A dark variant requires its own token, contrast and component audit before being offered                           |

Shared tokens are imported directly into the prototype and compiled with the repository's installed
Tailwind/DaisyUI/Vite tooling. Its isolated layout styles explore composition; they do not change
the production theme. Local JSON copy remains design material; production copy is now sourced from
the shared `libs/i18n` resources under PF-04/PF-11.

## 4. Screen and interaction specification

### Your profile

The first card contains photo, display name and a short introduction. The second contains community
role, up to five topics, spoken languages and a professional link. Labels remain visible. Optional
fields say so. The display name explicitly says it is public.

The display name, photo and introduction follow the minimal public-profile contract: the name is
always public, an uploaded photo is public when present, and an introduction is public when provided.
The photo and introduction have no publication toggle. The optional detail fields (interests,
spoken languages and personal website) retain independent **Show publicly** controls with a readable
state; the default is **Only you**. Emptying a field also withdraws its publication. Contact details
stay private and residence is never requested.

Editing updates the local draft. Save is explicit, with pending/success/failure state; Discard
restores the last saved values. Production saves use revision checks and refresh the real public
projection on the standalone profile route. A success toast supplements persistent status rather than
being the only evidence of a save. Keep form values on error and focus the first invalid field.

### Your gatherings

This is private activity navigation, not a public scorecard. Distinguish upcoming RSVPs from hosted
events, with proper empty states. Event cards retain their actual venue/city context without implying
residence. Held-event counts and completion labels require CO evidence. The prototype intentionally
uses an empty state; it does not invent event or attendance statistics.

### Preferences

Start with interface language, then notification categories and delivery methods. UI language changes
must preserve drafted user content and authored language. Push permission, device registration and
delivery eligibility are distinct states. Do not present a switch that claims to turn browser
permission on. Email is the default fallback after push. SMS is reserved for same-day cancellation
disruption and is server-controlled rather than a general profile preference.

Notification rows put the topic and plain-language explanation together, with the action at
inline-end. Keep authentication/security messages distinct from optional event reminders. Connect
all production switches to the dispatch policy specified by PF-08.

### Account and security

Group private contacts, login methods, devices and data separately. Mask sample/private account
identifiers until disclosure is relevant. Contact changes lead to verified update flows, and session
management identifies the current device. Account actions must never masquerade as profile-field saves.

Export explains what the member receives. Deletion is separated at the end, using readable error
color for the heading and a neutral review action. The confirmation must explain upcoming-event
handling, access withdrawal, retained records and asynchronous completion. Avoid emotionally
manipulative retention copy. Production requires reauthentication and the PF-10 lifecycle; a mock
success screen is not an implementation.

### Required production state designs

| State                        | Visible treatment                                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Initial load                 | Stable heading/layout; skeleton only where data is pending; no guessed member identity                                        |
| New/minimal member           | Initials and name; optional fields empty; welcoming preview, no profile-completion percentage                                 |
| Unsaved / saving             | Persistent status; explicit save button; prevent duplicate submits; keep keyboard focus stable                                |
| Validation error             | Inline associated text, first-invalid focus, field values preserved, no color-only signal                                     |
| Save conflict                | Explain another session changed the profile; offer reload/reapply; never silently replace the draft                           |
| Session expired              | Safe reauthentication and preserved non-sensitive draft; no disclosure to the next account                                    |
| Photo processing/failure     | Progress/status in the photo row; previous image retained on failure; remove/replace states distinguish draft and saved image |
| Offline/provider unavailable | Honest unavailable/retry explanation; no simulated saved/verified/connected status                                            |
| Profile hidden/deleted       | Safe public unavailable state without exposing private moderation reasons                                                     |
| Deletion/export pending      | Named job state and next step; completion only after backend confirmation                                                     |

These state treatments are implementation acceptance criteria. The initial prototype demonstrated
local editing, validation, publication, preview, discard, language switching, preference toggles and
explanatory account dialogs. Its preview and local-only behavior are historical; production uses the
real profile route, upload path, delivery controls and durable persistence described in the profile
plan.

## 5. Prototype use and engineering handoff

Run from the repository root using existing installed dependencies:

```sh
npx vite --config docs/design/profile/vite.config.ts
```

Open `http://127.0.0.1:4174/`. Build the isolated study with:

```sh
npx vite build --config docs/design/profile/vite.config.ts
```

Build output goes to ignored `dist/profile-design`; nothing is added to the production app routes
or deployment workflow. The study contains a fictional member and a persistent design-only notice.
Edits live in memory. Photo selection creates a local browser preview without transmitting the file.
Account buttons display the intended explanation, never change a real account. Reload resets it.

PF-04 owns the editable layout and query/form wiring; PF-05 the public projection/cache isolation;
PF-06 photos; PF-07 verified contacts and sessions; PF-08 live notification settings; PF-11 localized
state and accessibility completion. Production components remain under `features/profile/components`
and use the hook → API → shared server/domain/repository flow. The prototype's plain JavaScript and
sample copy are not production code to transplant.

## 6. Verification evidence

On 2026-09-08 the isolated Vite build succeeded. Browser DOM measurements covered all four sections
in `ar`, `fr`, `en` at 390/768/1280px: 36 combinations with no document horizontal overflow.
Visual inspection covered Arabic and English layouts. Editing the sample name, opting the biography
into the public preview, opening/closing the mobile preview and saving the local draft were exercised.
A shared CSS class collision and undersized visibility toggle found during the first inspection were
corrected before the breakpoint matrix.

This is design-prototype evidence, not production E2E or a full WCAG certification. Keyboard/zoom,
real virtual keyboards, assistive technology, low-bandwidth behavior, full photo processing, account
security and backend delivery still require the implementation plan's release gates. Desktop
full-page capture in the in-app browser showed stitching artifacts, so its capture is not presented
as a publication-ready design image; desktop layout bounds were checked through the rendered DOM.
