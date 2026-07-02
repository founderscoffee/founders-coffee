This psychological evaluation explores the architectural and design decisions of **founders.coffee** through the lenses of Cognitive Psychology and Behavioral Economics.

> **Auth model update (SRS FR-A4/D4 amended):** The platform now uses **phone-OTP (Twilio Verify) as the primary auth method**, with email-OTP as secondary/billing fallback. This directly addresses the "context-switching tax" identified in §1 below — phone-OTP eliminates the need to exit the PWA to check email, reducing the extraneous cognitive load spike at the auth boundary. The core analysis of email-OTP friction remains valid for the secondary email-OTP path and for future markets where email may be primary.

The core thesis of this project is highly sound: leveraging an existing, centuries-old Algerian café culture as a behavioral sandbox reduces the friction of real-world coordination. However, translating an informal physical habit into a digital product journey introduces subtle psychological barriers that could lead to user drop-off if not addressed natively.

---

## 1. Cognitive Load & Extraneous Friction

### The "Core Action" Load Spike

The most significant spike in **extraneous cognitive load** occurs during authentication. The platform has locked in passwordless email-OTP combined with social OAuth. In mobile-first markets like Algeria (where 118% mobile connections exist and WhatsApp/SMS are primary communication layers), forcing an email-OTP creates a jarring **context-switching tax**. The user must exit the PWA wrapper, open an email client, wait for synchronous delivery, copy a code, and return. This disrupts working memory and spikes cognitive load before the user can even perform an action.

Additionally, the **intrinsic cognitive load** spikes when a host is creating an event. Committing to host a meetup requires navigating real-world social anxiety and spatial logistics (selecting a café, defining capacity, managing visibility). If the form asks for all this data simultaneously, it induces choice paralysis.

### Information Architecture vs. Mental Models

Users treat digital community spaces through the mental models established by LinkedIn, Meetup, or corporate event platforms. These frameworks are heavy, transactional, and status-driven. Because founders.coffee is explicitly anti-corporate ("No formalities"), its Information Architecture (IA) must visually clash with corporate aesthetics.

- If the layout features data-heavy grids or overly structured categories, it activates a "formal business" mental model.
- The user will subconsciously shift from a casual "let's grab a coffee" mindset to a high-stakes "I need to prepare a pitch deck" mindset, violating brand principle 1.2.

### Progressive Disclosure (Hick's Law)

To maintain the casual tone, information must be disclosed dynamically. For event creation, instead of presenting a single long form with inputs for title, description, venue, capacity, and language, the UI should use a conversational progressive flow:

1. **Step 1 (Low stakes):** "Where are you drinking coffee today?" (Select a pre-seeded city/café).

2. **Step 2 (Medium stakes):** "When?" (Time/Date, defaulting to local timezone).

3. **Step 3 (Optional nuance):** "Who are you looking to meet?" (Casual description text area).

By narrowing the choice architecture at each step, you mitigate decision paralysis.

---

## 2. Behavioral Mechanics (Fogg Behavior Model: $B = MAP$)

According to the Fogg model, behavior happens when Motivation, Ability, and a Prompt converge simultaneously.

```
  HIGH MOTIVATION ───────────────────────────────┐
                                                 │   ★ Target Behavior Achieved
                                   Behavior      │   (RSVP or Host Event)
                                   Action Line   │
                                 ┌───────────────┘
  LOW MOTIVATION ────────────────┼────────────────
                                 │
                            LOW ABILITY     HIGH ABILITY
                         (Hard to Do)      (Easy to Do)

```

### Motivation ($M$)

The core psychological driver here varies by role:

- **Founders/Builders:** The alleviation of professional isolation and the search for authentic peer validation or collaboration.

- **Hosts:** Micro-status, community equity, and networking dominance.

The UI must visually validate this motivation not through gamified gamification corporate badges (which feel manipulative), but through **asymmetric social proof**. Showing that _"3 other builders from Algiers are going"_ triggers local belonging and a Fear of Missing Out (FOMO).

### Ability ($A$)

"Ability" is the optimization target because real-world coordination is hard. The physical effort of traveling to a café is an inescapable barrier. Therefore, the digital environment must make the _coordination_ feel entirely effortless.

- To lower the perceived effort, the UI must allow an RSVP in a single tap.

- The zero-cost ticket model creates a psychological side effect: **zero financial skin in the game leads to low accountability**, compounding the "cold-start / no-show death spiral" risk.

To counter this without charging fees, the UI must introduce a psychological mechanism: a micro-commitment check. A simple prompt like _"Can the host count on you to save a chair?"_ forces an explicit affirmative choice, activating the **Consistency Principle** (humans prefer to align their actions with their stated commitments).

### Prompts/Triggers ($P$)

- **Internal Trigger:** Loneliness, hitting a wall while programming, or the desire to talk shop on a Thursday afternoon.

- **External Trigger:** Because phone numbers are relegated to notifications (Decision D4/D5), leveraging WhatsApp pushes is critical. An external prompt must match the conversational tone. A notification saying _"An informal coffee is happening 15 minutes away from you in Algiers"_ acts as a hyper-contextual nudge that triggers immediate action.

---

## 3. The Onboarding Hook (The First 90 Seconds)

### The Time-to-Value (TTV) Journey

When a new user lands on a city page, their brain is scanning for environmental viability.

- **If events are active:** The TTV is reached when they see an interesting meetup near them within seconds. The first interaction must immediately deliver visual proof of life.

- **If the city is empty:** The platform faces its highest abandonment risk.

The requirement **FR-E6** addresses this brilliantly via the "Be the first host" empty state. Psychologically, this leverages the **Pioneer Effect**. Instead of signaling an "abandoned restaurant" (which triggers social proof avoidance), the copy must frame the empty state as an open, unvandalized canvas, appealing directly to the user's desire for autonomy and local leadership.

```
[User Lands on Empty Page] ──► [Vibe Check: Is this dead?]
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼ (Poor Copy)                                         ▼ (FR-E6 Pioneer Framing)
   "No events found."                                    "Algiers is an open canvas.
            │                                             Be the first to host a coffee."[cite: 1]
            ▼                                                     │
   [Triggers Avoidance]                                           ▼
   Result: Abandonment                                   [Triggers Autonomy/Status]
                                                         Result: Host Acquisition

```

### Abandonment Pitfalls

The primary drop-off point will be the transition from browsing to authenticating via email-OTP. If a user clicks "RSVP" and is instantly hit with an un-optimized email input field without contextual framing, the cognitive cost will feel greater than the ambiguous reward.

To sustain momentum, the authentication gate should explain _why_ it needs identity confirmation using low-stakes language: _"Where should we send your calendar invite and host details? No passwords required."_

---

## 4. Form Factor & Output Deliverables

The interface design must act as a psychological buffer against over-formalization, stabilizing the community density required to sustain the platform.

| User Journey Step                           | Psychological Barrier                                                                                     | UI/UX Design Remedy |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------- |
| **1. City Discovery & Landing** (`apps/ui`) | **The Ghost-Town Effect:** Landing on a city page with zero scheduled events can signal platform failure. |

| **Pioneer Framing (FR-E6):** Replace "No events" with high-agency copy: _"Algiers is quiet this week. Grab a coffee and be the pioneer host."_ Use large, warm typography that mirrors casual text messaging over rigid dashboards.

|
| **2. Account Authentication** (Better Auth) | **Context-Switching Apathy:** Leaving the PWA to pull a verification token from an email client kills interaction momentum.

| **OAuth Prioritization & Smart Fallbacks:** Elevate Google/GitHub/LinkedIn buttons to the top layer for true one-click entry. If email-OTP is used, employ deep-linking to auto-open popular mail clients or design an ultra-clear placeholder explaining the zero-password approach.

|
| **3. Event Creation Flow** (`apps/dashboard`) | **Social Performance Anxiety:** The fear that hosting an event requires formal presentation preparation or that no one will show up.

| **Framing Constraints & Pre-seeded Defaults:** Use descriptive placeholders in text fields (e.g., _"We're just talking about local payment rails, no slides allowed"_). Force a strict ceiling on descriptions to prevent long, intimidating manifestos.

|
| **4. Event RSVP Confirmation** | **Zero-Cost Accountability Slump:** Because the event is free, the psychological cost of skipping it is zero, leading to the no-show death spiral.

| **Asymmetric Social Commitment (FR-E10):** Instead of a sterile "Success" page, display the host's avatar alongside an interactive micro-commitment: _"Amin is reserving a chair for you. Confirm you're still coming via WhatsApp."_<br> |
| **5. Hackathon Entry** (`apps/dashboard` / P2) | **Imposter Syndrome & Evaluation Anxiety:** Students and early builders opting out due to high perceived skill barriers or overly rigid corporate criteria.

| **Communal Rubrics & Team-First IA:** Reframe judging criteria (FR-H4) around "scrappiness and learning" rather than enterprise-level viability. Build a prominent "Looking for Team" matchmaking layout that emphasizes psychological safety and collective learning over intense competition.

|
