# Sponsorship Value-Delivery & Measurement — Implementation Plan

| Field        | Value                                                                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Document     | Sponsorship Measurement Plan — founders.coffee                                                                                                 |
| Version      | 1.0                                                                                                                                            |
| Status       | Planned P3 design; not an operational-status document                                                                                          |
| Owner        | Engineering + Growth                                                                                                                           |
| Last updated | 2026-06-25                                                                                                                                     |
| Derived from | [SRS v1.2](./srs.md) (FR-S1..S5, FR-P4, §5.4, §10.3) · [implementation-plan.md](./implementation-plan.md) Phase P3 · [AGENTS.md](../AGENTS.md) |
| Phase        | P3 (expands epics P3-A, P3-C, P3-D + touches P1-011/012/014, P2)                                                                               |

> This plan operationalizes _how_ sponsors receive value they can **see and measure** — and the infrastructure to deliver, attribute, and report it. It is the detailed expansion of the main plan's P3 sponsorship epics. All recommendations below are validated against 2025–2026 sponsorship-measurement industry consensus (see §2).

The SRS, AGENTS.md, and active implementation plan remain authoritative. This design does not imply that its queues, bindings, dashboards, or reports are provisioned today.

---

## 1. Purpose

Sponsors pay for **a business outcome** (acquisition, talent, brand), not logos. Community-sponsorship ROI is notoriously squishy, so to win **renewals** (not just first deals) we must move sponsors up a **measured value hierarchy** — from vanity impressions to attributable outcomes, with **talent as the premium tier**.

This plan defines the data model, Cloudflare-native attribution pipeline, sponsor dashboard, reporting, and the privacy/brand-safety guardrails that make sponsorship a **renewable, defensible** revenue line.

**Hard precondition (restated):** measurable value exists only after **community density** (P1). Do not sell sponsorships at scale before the audience exists; the audience _is_ the product.

---

## 2. Validation summary (research, 2025–2026)

| Recommendation                                                   | Validated by                                                                                                                                                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Move from vanity → outcome metrics                               | [Dr. Dan Kaufmann](https://drdankaufmann.substack.com/p/sponsorship-strategy-101-the-sponsorship); [Riggs & Co.](https://www.riggsand.com/blog/the-future-of-event-sponsorship-new-models-value-propositions) |
| Outcome-based / advanced attribution is the 2025–26 trend        | [Lumency](https://lumency.co/2025/01/22/global-sponsorship-trends-report/); [Trajektory](https://trajektory.com/blog/2025-sponsorship-tracking-and-valuation-expectations-amp-predictions)                    |
| Promo codes + UTM + unique links for attribution                 | [Artisan](https://www.artisan.co/blog/sponsorship-roi); [Univ. of Minnesota vanity URLs](https://umarcomm.umn.edu/blog/2024/09/09/u-marcomm-guide-to-utm-tracking)                                            |
| KPI set = Exposure → Engagement → Conversion → Brand Lift        | [SponsorUnited 25 KPIs](https://www.sponsorunited.com/insights/25-potential-kpis-for-sponsorship-deals)                                                                                                       |
| Dynamic QR + sponsor-specific codes + real-time dashboards + CRM | [Pimms](https://pimms.io/products/dynamic-qr-codes-tracking-marketing); [QR-Tiger/HubSpot](https://www.qrcode-tiger.com/hubspot-qr-code-tracking-attribution); [QRAnalytica](https://v2.qranalytica.com/)     |
| Talent-pool access is the premium monetization                   | [Toptal](https://www.toptal.com/); [Andela](https://www.1840andco.com/blog/andela-alternatives); [Turing](https://workforcenext.in/blog/toptal-vs-andela-vs-turing-vs-workforcenext-comparison-2026/)         |
| Multi-touch attribution + performance pricing                    | [Attendir](https://attendir.com/blog/measure-event-marketing-roi); [PwC sports sponsorship playbook](https://www.pwc.com/us/en/industries/tmt/library/sports-sponsorships-playbook.html)                      |

**Industry signal:** 66% of consumers are more likely to buy from sponsors (up from 59% in 2022) — sponsorship conversion potential is real and rising ([Sports Business Journal, May 2025](https://www.sportsbusinessjournal.com/Articles/2025/05/07/measure-what-matters-new-data-reveals-the-true-drivers-of-sports-sponsorship-success/)).

---

## 3. The measurable value hierarchy (what we sell + measure)

| Tier                       | Metric                                                         | How measured                                         | Strength                             |
| -------------------------- | -------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------ |
| **1. Exposure**            | Impressions, reach (unique builders), logo views               | Page/event/email view events → Analytics Engine      | Vanity (directional)                 |
| **2. Engagement**          | QR scans, link clicks, booth interactions, voucher redemptions | Tracking redirect route logs scans/clicks            | Measurable                           |
| **3. Acquisition**         | Conversions: SIM/plan, account, app install, product signup    | Promo-code + UTM + conversion ingest (pixel/webhook) | **Attributable**                     |
| **4. Talent**              | Warm intros, applications, **hires** from the pipeline         | Talent-pipeline intros linked to sponsor (opt-in)    | **Highest value, defensible**        |
| **5. Sponsored challenge** | Vetted submissions, ranked talent signal, product engagement   | P2 challenge engine linked to sponsor                | **Premium, measurable**              |
| **6. Brand lift**          | Awareness/consideration delta                                  | Pre/post micro-surveys                               | Directional but expected by sponsors |

**Strategy:** price and renew on tiers 3–5 (outcomes/talent), report tiers 1–2 as supporting color. **Bundle sponsorship with talent access** — that is what justifies 1.5–3M DZD/year instead of a logo fee (the eChai/Hummingbird model).

---

## 4. Architecture & data flow (Cloudflare-native)

### 4.1 Cloudflare service mapping

| Service                   | Role in measurement                                                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Workers**               | Tracking/redirect routes (`/r/{token}`, `/go/{code}`); sponsor dashboard API; conversion ingest                                                            |
| **D1 (Drizzle)**          | Sponsors, sponsorships, promo codes, QR tokens, confirmed conversions, talent intros, report metadata, materialized metric snapshots                       |
| **Analytics Engine**      | **Primary high-volume event store** — scans/clicks/impressions/conversions as time-series (cheap, high-cardinality). The aggregation source for dashboards |
| **KV**                    | Hot idempotent lookups: token→destination, code→sponsor; cached aggregate metrics for the dashboard                                                        |
| **Durable Objects + WAF** | Strongly consistent identity/token rate limits plus blunt edge-volume protection                                                                           |
| **Queues**                | Async ingestion: redirect logs an event to Analytics Engine sync, enqueues a detail event to a Queue for D1/aggregation (never blocks the redirect)        |
| **R2**                    | Sponsor logos/assets; generated PDF impact reports                                                                                                         |
| **Browser Rendering**     | Render HTML report → PDF for monthly/quarterly impact reports                                                                                              |
| **Cloudflare Email**      | Deliver impact reports to sponsor contacts                                                                                                                 |
| **Workers AI**            | Audience-quality segmentation (aggregated cohorts); natural-language summary of the monthly report                                                         |
| **Cron / DO Alarms**      | Schedule report generation; backstop aggregations                                                                                                          |
| **Turnstile**             | Protect conversion-ingest + promo-redemption endpoints from fraud (fake conversions)                                                                       |

### 4.2 Data flow

```
[Event/Email/QR] ──scan/click──▶ /r/{token} Worker
                                      │
                                      ├─ KV lookup (token → sponsor+target)        [fast]
                                      ├─ Analytics Engine.write (scan/click event) [sync, cheap]
                                      ├─ Queue.enqueue (detail event)              [async]
                                      └─ 302 redirect → target URL + UTM params

[Queue consumer (worker-jobs)] ─▶ D1 AttributionEvent / aggregate → SponsorMetricSnapshot

[Sponsor site / pixel / webhook] ──conversion──▶ /c/{code} Worker
                                      │
                                      ├─ Turnstile verify
                                      ├─ match code/token → sponsor (multi-touch)
                                      └─ D1 Conversion (+ Analytics Engine)

[Talent pipeline (P3-C)] ──intro/hire──▶ D1 TalentIntro (sponsor_id, opt-in) ─▶ dashboard + reports

[DO Alarm / Cron] ─▶ aggregate period ─▶ Browser Rendering PDF ─▶ R2 ─▶ Cloudflare Email ─▶ sponsor
```

### 4.3 Attribution model

- **Multi-touch, last-touch default.** Every touch (scan/click) recorded with sponsor + timestamp + anonymous user ref. Conversions attributed last-touch by default, with **first-touch + assist count** available (honest about attribution limits — see §8).
- **Anonymous user ref** (first-party cookie/localStorage id) for scan/click — **not PII**. Cross-device gaps are accepted and disclosed.
- Conversions matched by **promo code**, **tracking token**, or **user ref**.

---

## 5. Data model (Drizzle, `libs/db`)

```
Sponsor
  id, name, logo_r2_key, markets[], contacts[], status

Sponsorship
  id, sponsor_id, package_type, surface (series|event|challenge|founder_picks|coffee_voucher)
  market_code, start_date, end_date, disclosure_text, order_id (→ Order), status

PromoCode
  id, sponsor_id, sponsorship_id, code (unique), utm {source,medium,campaign,content}
  target_url, conversion_goal (sim|account|app_install|signup|other), active

TrackingToken (QR / short link)
  id, token (unique), sponsor_id, sponsorship_id, surface, target_url_with_utm, active

AttributionEvent   (high-volume; Analytics Engine primary, D1 mirror for joins)
  id, sponsor_id, type (impression|scan|click|conversion|redemption|voucher)
  surface, market_code, state_code?, city_code?, ts, anon_user_ref, conversion_goal, value_minor, currency

Conversion   (confirmed, in D1)
  id, sponsor_id, promo_code_id?, token_id?, anon_user_ref, goal, ts, value (Money), attributed (last|first|assist)

TalentIntro   (links talent pipeline FR-P4 to sponsor; opt-in required)
  id, sponsor_id, participant_user_id (opt-in), challenge_id?, status (offered|accepted|declined)
  outcome (intro|hired|none), attributed_value (Money?), consent_at

SponsorMetricSnapshot   (materialized for dashboard speed)
  sponsor_id, period (day|week|month), metrics_json {impressions, reach, scans, clicks, conversions, hires, ...}

ImpactReport
  id, sponsor_id, period_start, period_end, metrics_json, summary_text (AI), pdf_r2_key, sent_at
```

**Money rule (AGENTS.md §6):** all monetary values are `{ amount_minor, currency }`.

---

## 6. Metrics definitions (what each means + source)

| Metric                  | Definition                                                             | Source                            |
| ----------------------- | ---------------------------------------------------------------------- | --------------------------------- |
| **Impressions**         | Count of sponsored-surface views (event page, email open, logo render) | Analytics Engine                  |
| **Reach**               | Unique anon_user_ref exposed in period                                 | Analytics Engine (distinct count) |
| **Scans**               | QR code scans via `/r/{token}`                                         | Analytics Engine + D1             |
| **Clicks**              | Promo-link clicks via `/go/{code}`                                     | Analytics Engine + D1             |
| **Conversions**         | Confirmed goal completions matched to sponsor                          | D1 `Conversion`                   |
| **Conversion rate**     | Conversions / (scans+clicks)                                           | Computed                          |
| **Voucher redemptions** | Sponsored-Coffee vouchers redeemed at partner café                     | D1 (café reconciliation)          |
| **Talent intros**       | Opt-in warm intros made to sponsor                                     | D1 `TalentIntro`                  |
| **Hires**               | Intros with `outcome = hired`                                          | D1 `TalentIntro`                  |
| **Audience quality**    | Aggregated cohort split (role/seniority/market) — anonymized           | D1 profiles (aggregated)          |
| **Brand lift**          | Δ awareness/consideration from pre/post surveys                        | Survey results (D1)               |

---

## 7. Privacy, consent & brand-safety (non-negotiable)

- **Anonymous attribution:** scans/clicks use a first-party anonymous ref — **no PII** in the event stream. Sponsors see **aggregated** data only.
- **Talent opt-in (FR-P4, NFR-5):** a member's identity is shared with a sponsor **only on explicit, revocable consent** recorded in `TalentIntro.consent_at`. No silent profiling.
- **Disclosed sponsorship (FR-S3):** every sponsored surface shows a clear "sponsored by" badge. **One sponsor per event.**
- **No surveillance / no aggressive in-feed ads:** promo codes and QR are **opt-in actions** the user chooses. No third-party ad trackers, no behavioral profiling. Strict CSP (AGENTS.md §10).
- **Fraud protection:** Turnstile + rate-limiting on conversion-ingest and promo-redemption to prevent sponsors (or attackers) from inflating metrics or faking conversions.
- **Data retention:** raw attribution events retained on a defined schedule; aggregated snapshots retained longer. Documented per market (NFR-5/6).

---

## 8. Honest attribution caveats (communicate to sponsors)

1. Cross-device/cross-session conversions are **under-counted** (anonymous ref can't bridge devices). Disclose; lean on promo-code conversions (deterministic).
2. **View-through** (sponsor seen at event → converts later via search) is mostly unattributable. Report it as directional brand-lift, not hard conversion.
3. Talent outcomes (hires) can lag **weeks–months**; report on a trailing window and reconcile retroactively.
4. Over-claiming attribution destroys sponsor trust faster than under-delivering. **Under-promise, over-prove.**

---

## 9. Tickets (Phase P3)

Format mirrors the main plan. `SP-*` IDs. Dependencies reference main-plan tickets where relevant.

| ID         | Title                                                                                                                                                                                      | Deps                   | Implements          | CF services                                         | Size |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ------------------- | --------------------------------------------------- | ---- |
| **SP-001** | `libs/domain/sponsorships` + `libs/db` schema: Sponsor, Sponsorship, PromoCode, TrackingToken, AttributionEvent, Conversion, TalentIntro, SponsorMetricSnapshot, ImpactReport + migrations | P0-006                 | FR-S1/S2, §5        | D1                                                  | L    |
| **SP-002** | Tracking **redirect Worker route** (`/r/{token}`, `/go/{code}`): KV lookup → Analytics Engine write (sync) → Queue enqueue (detail) → 302 redirect with UTM                                | SP-001, P0-011         | §4.2                | Workers, KV, Analytics Engine, Queues               | M    |
| **SP-003** | **Promo-code + UTM link manager** (admin + sponsor portal): create codes/tokens, strict UTM naming convention, define conversion goals, generate QR images → R2                            | SP-001, P0-010         | FR-S1, §3           | R2, D1                                              | M    |
| **SP-004** | **Dynamic QR generation**: sponsor-specific tokens, render QR PNG to R2, editable destination (post-print)                                                                                 | SP-003                 | §3, §4.2            | R2, Workers                                         | S    |
| **SP-005** | **Attribution aggregation pipeline**: Queue consumer → Analytics Engine queries → materialize `SponsorMetricSnapshot` (cron-driven); multi-touch attribution (last/first/assist)           | SP-002, P0-018         | §4.3, §6            | Queues, Analytics Engine, Cron, D1                  | L    |
| **SP-006** | **Conversion ingestion**: `/c/{code}` endpoint + sponsor webhook + optional pixel; Turnstile-protected; match code/token/user-ref → `Conversion` (D1) + Analytics Engine                   | SP-002                 | §3 (Acquisition)    | Workers, Turnstile, D1, Analytics Engine            | M    |
| **SP-007** | **Talent attribution**: link talent-pipeline intros (P3-C) to `Sponsor`; track outcomes (intro→hired); consent-gated (FR-P4)                                                               | SP-001, P3-C           | FR-P4, §3 (Talent)  | D1                                                  | M    |
| **SP-008** | **Sponsor dashboard** (`apps/dashboard`, `sponsor_contact` role): live metrics across the 6 tiers, audience-quality cohorts, TanStack Table + Query; KV-cached aggregates                  | SP-005, P0-010         | FR-S4, §3           | TanStack Table/Query, KV, Analytics Engine          | L    |
| **SP-009** | **Impact report generation**: DO alarm/cron → aggregate period → Workers AI summary → Browser Rendering PDF → R2 → Cloudflare Email to sponsor                                             | SP-005, P0-016         | FR-S4, §3           | DO Alarms, Workers AI, Browser Rendering, R2, Email | M    |
| **SP-010** | **Brand-lift micro-surveys**: pre/post-event survey component, results into metrics (D1)                                                                                                   | SP-001, P1-007         | §3 (Brand lift), §6 | D1                                                  | S    |
| **SP-011** | **Privacy/consent + retention**: anonymous-ref enforcement, opt-in talent consent flow, retention policy job, aggregated-only sponsor views                                                | SP-001, P0-008         | FR-P4, NFR-5, §7    | D1, Cron                                            | M    |
| **SP-012** | **CRM export + integration**: CSV export + outbound webhook (sponsor CRM: HubSpot-class) with event payload                                                                                | SP-008                 | §3                  | Workers, Queues                                     | S    |
| **SP-013** | **Sponsored-Coffee voucher attribution**: link voucher redemptions (SRS §5.4) to sponsor metrics + café reconciliation (manual payment, Year 1)                                            | SP-006, P0-015         | FR-S2, §10.3        | D1, Queues                                          | M    |
| **SP-014** | **Sponsored-challenge attribution**: link P2 challenge participation/submissions to sponsor (talent signal + engagement metrics)                                                           | SP-001, P2             | FR-H7, §3           | D1, Analytics Engine                                | M    |
| **SP-015** | **Sponsor onboarding + Order**: sponsorship package catalog, self-serve purchase → `Order` → manual "mark as paid" (P0-015) → activate sponsorship + disclosure                            | SP-001, P0-015, P1-014 | FR-S1, §10.3        | D1                                                  | M    |
| **SP-016** | **Tests (Miniflare) + e2e**: full attribution flow (scan → aggregate → dashboard), conversion ingest, report generation; no platform mocks                                                 | SP-008, SP-009         | NFR-11              | Miniflare, Playwright                               | M    |
| **SP-017** | **Observability**: internal Analytics Engine dashboards (sponsor revenue, attribution volume, conversion latency) + alerts on ingest backlog                                               | SP-005                 | NFR-7               | Analytics Engine                                    | S    |

**Exit criteria:** a sponsor can purchase a package → get codes/QR → run a campaign → see live exposure/engagement/acquisition/talent metrics on their dashboard → receive a monthly PDF report → renew based on measured ROI. Brand-safety + consent enforced throughout.

---

## 10. Dependencies on the main plan

- **Requires (must exist first):** P0-006 (`libs/db`), P0-008 (auth/RBAC incl. `sponsor_contact` role), P0-010 (`libs/ui`), P0-011 (`libs/infra`), P0-015 (`libs/payments` + Order), P0-016 (`libs/email`), P0-018 (`worker-jobs`), P1-014 (sponsor Order admin).
- **Feeds into:** P3-A (sponsor portal = SP-008/015), P3-C (talent pipeline = SP-007), P3-D (sponsor reconciliation = SP-009/013).
- **Density gate:** do not launch sponsor acquisition (SP-015 marketing) until P1 density thresholds are met — the metrics will be empty and sponsors will churn.

---

## 11. Risks

| Risk                                                  | Severity | Mitigation                                                                                           |
| ----------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| **Selling before density** → empty metrics → churn    | High     | Hard gate on P1 density (§10); land 2–3 founding sponsors at lower price to baseline value first     |
| **Attribution under-counting** erodes sponsor trust   | Medium   | Disclose caveats (§8); lean on deterministic promo-code conversions; multi-touch not just last-click |
| **Fraud / inflated metrics** (fake scans/conversions) | Medium   | Turnstile + rate-limit on ingest/redemption; anomaly detection in aggregation                        |
| **Brand-safety erosion** → community feels "sold to"  | High     | One sponsor/event, disclosed, opt-in actions only, no surveillance (§7, SRS §9)                      |
| **Analytics Engine cost at high event volume**        | Low-Med  | Sample high-frequency impression events; keep scans/clicks/conversions full-fidelity                 |
| **Talent outcome lag** (hires take weeks)             | Medium   | Trailing-window reporting + retroactive reconciliation (§8)                                          |
| **Sponsor data export leaking PII**                   | High     | Aggregated-only views; talent data only via opt-in; reviewed export payloads (§7)                    |

---

## 12. Pricing evolution (informed by measurement)

Year 1 prices (1.5–3M DZD anchor) are **guesses until baselined**. Use the first 2–3 founding sponsors to measure **cost-per-reached-builder** and **value-per-hire**, then:

- Move toward **performance-based** pricing (pay-per-acquisition / pay-per-hire) for sponsors who want it — the 2025–26 industry trend.
- Keep **talent access bundled** into every package (the defensible premium).
