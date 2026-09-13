# SEO Implementation Plan

## founders.coffee — technical SEO and discoverability

| Field         | Value                                                                                                                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Version       | 1.0                                                                                                                                                                                    |
| Status        | In progress                                                                                                                                                                            |
| Owner         | Engineering                                                                                                                                                                            |
| Created       | 2026-09-13                                                                                                                                                                             |
| Scope         | Public discovery surfaces in `apps/ui`: markets, cities, events, company pages, and the intentional public-profile policy                                                              |
| Requirements  | FR-E5, FR-E6, FR-E7, FR-A6, FR-A7, FR-L1 through FR-L6; NFR-1, NFR-4, NFR-7, NFR-9, NFR-10, NFR-12                                                                                     |
| Related plans | [SRS](./srs.md), [main implementation plan](./implementation-plan.md), [profile and account plan](./profile-account-implementation-plan.md), [release strategy](./release-strategy.md) |

This plan is based on a repository and live-staging audit performed on 2026-09-13. It is an
implementation plan; the progress note below records the completed tickets and the remaining items
are not shipped. The current community-building release remains the boundary: SEO work serves
free local events, repeat participation, hosts,
trust, and the PWA. Sponsorship, challenges, talent, payments, and expansion remain future work.

Current progress: SEO-01 through SEO-10 are implemented and locally verified; SEO-11 through SEO-12 remain planned.

## 1. Audit baseline

| Area             | Current state                                                                                                                                    | Consequence                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical URLs   | The root head emits `https://founders.coffee` for every route. Market and city routes do not replace it. Company pages add a second canonical.   | Search engines can consolidate market, city, event, and company pages into the homepage or choose inconsistently.                            |
| Environment      | `SITE_ORIGIN` is hardcoded in `apps/ui/src/lib/seo.ts`; staging uses the same production URLs in canonical, OG, and JSON-LD output.              | Staging can be indexed as duplicate production content and can share the wrong links.                                                        |
| Sitemap          | `/sitemap.xml` returns 404 in production and staging.                                                                                            | Crawlers lack an authoritative URL inventory, especially for dynamic events.                                                                 |
| Robots           | `robots.txt` allows all paths and does not reference a sitemap.                                                                                  | Utility, auth, and staging URLs are crawlable; discovery is not guided.                                                                      |
| Locales          | `PARAGLIDE_LOCALE` is a cookie-only switch. There are no locale URL variants or `hreflang` links.                                                | Arabic, French, and English versions are not independently discoverable and are duplicate content at one URL.                                |
| Market/city head | Market pages set only title/description. City pages set title/description/robots and a `Place` block.                                            | Missing canonical, social metadata, locale metadata, and collection semantics. City copy can say “be the first host” even when events exist. |
| Event head       | Event routes set title, description, and basic OG title/description/type.                                                                        | Missing canonical, URL, locale, image, Twitter tags, and a reliable description fallback.                                                    |
| Event schema     | `EventDetail` emits a basic `Event` JSON-LD block in the body.                                                                                   | URL, end date, offer, image, postal address, and cancellation status are absent or incomplete.                                               |
| Social sharing   | No `og:image` or `twitter:image` is emitted.                                                                                                     | Shared pages have weak previews and lower click-through potential.                                                                           |
| Pagination       | “Load more” is a client-side button; only the first page is server-rendered.                                                                     | Events after the first page have no crawlable list URL.                                                                                      |
| Prerendering     | Routes carry `staticData: { prerender: true }`, but `apps/ui/vite.config.ts` does not enable TanStack Start `prerender.enabled` or `crawlLinks`. | The flags alone do not prove that HTML was prerendered or that a route inventory was generated.                                              |
| Utility pages    | Login and host creation have no robots directive. Generic 404 pages inherit the homepage metadata.                                               | Thin or error pages can enter the index.                                                                                                     |
| Profiles         | `/u/$userId` is public by URL but sends `noindex, nofollow` and `private, no-store`, matching the current profile plan.                          | This is an intentional privacy/product decision, but it limits host-profile discovery and must not be accidentally changed by SEO work.      |
| Roadmap status   | P1-007 is marked complete even though metadata and prerender acceptance are not complete.                                                        | Roadmap status does not reflect operational reality.                                                                                         |

## 2. Decisions and constraints

1. Production public pages are indexable only when they contain useful, stable content. Account,
   onboarding, host-creation, live-room, closeout, utility, and error pages are `noindex`.
2. Staging is never indexable. Every staging document response sends `X-Robots-Tag: noindex, nofollow`
   and staging `robots.txt` disallows all paths. Production and staging use different origin values.
3. Canonical URLs are absolute, HTTPS, environment-aware, query-free unless a query is part of the
   public content contract, and point to the final slug URL after redirects.
4. Locale is part of the public URL. The proposed shape is `/{locale}/{market}`,
   `/{locale}/{market}/{city}`, and `/{locale}/{market}/e/{slug}`, with `ar`, `fr`, and `en`.
   Existing locale-neutral URLs remain supported through permanent redirects after migration. Arabic
   remains the fallback when no locale is supplied.
5. User-generated text is rendered as authored. Metadata helpers normalize whitespace and truncate by
   Unicode code points, never by UTF-16 code units. No private profile field enters metadata, JSON-LD,
   sitemaps, or social cards.
6. Public profiles remain `noindex` unless Founder / Product explicitly changes the profile plan.
   A change in that decision gets its own privacy and cache ticket.
7. No new vendor, dependency, or Cloudflare service is required for the baseline. Use existing D1,
   TanStack Start SSR, R2/Images bindings where configured, and static branded assets. Optional
   Browser Rendering OG cards remain future scope under P1-022.
8. SEO composition is pure shared code and follows the existing route → feature API/hooks → server
   function → domain/repository flow. It must not import database or server-function internals.
9. TanStack Start's built-in build-time sitemap is suitable for stable, link-crawled pages, but it is
   not the source of truth for D1-backed events that change after a build. Use a dynamic
   `sitemap[.]xml.ts` server route for the authoritative production inventory; enable TanStack
   prerendering and link crawling separately where the generated HTML is safe and deterministic.

## 3. Public URL inventory

| URL class                                                      | Index policy                                                    | Required representation                                               |
| -------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------- |
| Locale market landing                                          | Index when market is visible and enabled                        | `WebPage`/`CollectionPage`, localized metadata, canonical, OG/Twitter |
| Locale city landing                                            | Index when it has events or an approved community landing state | `CollectionPage` plus `ItemList`                                      |
| Locale event detail                                            | Index while public and discoverable                             | `Event` JSON-LD, canonical, date/location/host metadata, social card  |
| Company pages                                                  | Index                                                           | `WebPage`, canonical, localized content, OG/Twitter                   |
| Public host profile                                            | Noindex under current plan                                      | `X-Robots-Tag`, no sitemap entry, no private fields in metadata       |
| Login/onboarding/account/profile/preferences/activity/closeout | Noindex                                                         | Route and response-header directives                                  |
| Host creation wizard                                           | Noindex                                                         | Route directive; workflow queries are not public URLs                 |
| 404 and error documents                                        | Noindex                                                         | Dedicated title; no canonical to a valid page                         |

## 4. Work breakdown

### SEO-01 — Environment-aware indexation policy

**Requirements:** NFR-4, NFR-7, NFR-10. **Depends on:** none.

- Replace hardcoded `SITE_ORIGIN` with an origin derived from existing `APP_URL` and a validated
  production fallback.
- Add one indexation policy helper for document headers, route heads, robots, and sitemap.
- Set staging `X-Robots-Tag: noindex, nofollow` on HTML responses and disallow staging in robots.
- Keep assets crawlable where appropriate; robots is not a data-protection mechanism.

**Acceptance:** staging never emits production canonicals and always has a noindex response header;
production public pages contain no staging references; local development remains usable.

### SEO-02 — Canonical and redirect normalization

**Requirements:** FR-E5, FR-E6, NFR-1. **Depends on:** SEO-01.

- Create one canonical URL builder for locale, market, city, event, and company paths.
- Ensure each indexable document emits exactly one canonical link.
- Set matching `og:url` and JSON-LD `url` values from the same builder.
- Preserve market-code-to-slug redirects and add locale-aware redirects without chains.
- Strip tracking parameters from canonical URLs and define the workflow-query policy.

**Acceptance:** HTML tests assert one canonical per indexable page; all public classes self-canonicalize;
redirects reach the canonical URL in one hop; staging links are environment-local and non-indexable.

### SEO-03 — Crawlable locale URLs and `hreflang`

**Requirements:** FR-L1 through FR-L6, NFR-12. **Depends on:** SEO-02.

- Add locale-prefixed public routes for `ar`, `fr`, and `en`; keep the cookie as a UI preference only.
- Derive SSR content, title, description, `lang`, `dir`, and structured data from the route locale.
- Emit reciprocal `rel="alternate" hreflang` links and `x-default` for the locale-neutral entry point.
- Redirect legacy locale-neutral public paths to the selected/default locale without loops.
- Keep authored event/profile text unchanged while localizing interface labels.

**Acceptance:** every public page has stable locale URLs; no-cookie crawlers receive the intended
default locale; each locale self-canonicalizes; reciprocal hreflang tests pass.

### SEO-04 — Sitemap generation and robots policy

**Requirements:** FR-E5, FR-E7, NFR-1. **Depends on:** SEO-01, SEO-02, SEO-03.

**Status:** Implemented and locally verified.

- Add production `/sitemap.xml` using existing market, city, event, and company repositories.
- Implement it as a dynamic `sitemap[.]xml.ts` server route because event and market records are D1 data
  that change after builds. Do not replace it with a stale build-only sitemap.
- Include only canonical public URLs; exclude profiles under the current policy, utility routes,
  staging data, canceled/private events, and query variants.
- Emit `lastmod` only from trustworthy persisted timestamps.
- Keep the response bounded and cacheable; add a sitemap index only when volume requires it.
- Reference the sitemap from production robots; staging disallows all paths.

**Acceptance:** valid XML/content type; every eligible URL appears exactly once; no noindex URL appears;
production robots references it; parsing and inclusion/exclusion tests pass.

### SEO-05 — Shared page metadata builder

**Requirements:** FR-E5, FR-E6, FR-E7, FR-L1 through FR-L6. **Depends on:** SEO-02, SEO-03.

**Status:** Implemented and locally verified.

- Produce title, description, robots, canonical, OG, Twitter, locale, and alternate-link metadata
  from one shared helper.
- Use localized market and city names in titles and unique, stable descriptions.
- Select city copy based on event availability instead of always using the empty-state message.
- Provide a useful fallback for events without descriptions.
- Normalize whitespace and bound authored values before HTML or JSON-LD serialization.

**Acceptance:** snapshots cover all indexable routes in all locales; no empty descriptions, duplicate
titles, mismatched language, or inherited homepage OG/canonical values remain.

### SEO-06 — Structured data for discovery pages

**Requirements:** FR-E5, FR-E6, FR-E7, NFR-12. **Depends on:** SEO-05.

**Status:** Implemented and locally verified.

- Keep the Organization entity with authoritative fields only; remove empty optional properties.
- Add `WebSite`/`WebPage` or `CollectionPage` data where it describes the actual page.
- Replace city `Place` data with `CollectionPage` plus an `ItemList` of public server-rendered events.
- Complete event JSON-LD with canonical URL, dates, timezone-aware location, `PostalAddress` when
  available, organizer, free-event `offers`, status, and `inLanguage`.
- Add `BreadcrumbList` to city and event pages.
- Never expose private profile fields, RSVP state, or hidden data.

**Acceptance:** JSON-LD parses without errors; dates/status/URLs agree with rendered content; canceled
events do not claim scheduled status; representative pages pass Rich Results validation.

### SEO-07 — Social preview assets and metadata

**Requirements:** FR-E5, FR-E7, NFR-1. **Depends on:** SEO-05.

**Status:** Implemented and locally verified.

- Add a branded default social image with stable dimensions and alt text.
- Emit `og:image`, dimensions, alt, and `twitter:image` for market, city, event, and company pages.
- Use event/market images only when public, processed, and safe. Do not introduce Browser Rendering;
  P1-022 remains the future dynamic-card option.

**Acceptance:** social-card parsers retrieve a valid image for every indexable page; no private,
staging, or unprocessed asset appears in production tags.

### SEO-08 — Crawlable event pagination and internal linking

**Requirements:** FR-E5, FR-E7, NFR-1. **Depends on:** SEO-04, SEO-05.

**Status:** Implemented and locally verified.

- Add crawlable pagination for market, city, and hosted-event history when the first page is incomplete.
- Keep “load more” for users, but render normal links for crawlers and keyboard users.
- Ensure sitemap coverage makes every public event reachable beyond the first page.

**Acceptance:** JavaScript-disabled crawlers reach all sitemap-listed event pages; pagination does not
duplicate page one; links use canonical locale/market slugs.

### SEO-09 — Utility, error, and privacy directives

**Requirements:** FR-A6, FR-A7, NFR-4. **Depends on:** SEO-01, SEO-02.

- Add route and response-header noindex to login, onboarding, account, profile editor, preferences,
  activity, closeout, host creation, and other transactional paths.
- Add a dedicated 404/error head with localized title, noindex, no homepage canonical, and no
  misleading Organization-only SEO payload.
- Preserve public-profile noindex/no-store and test that private fields never enter metadata, JSON-LD,
  sitemap, or caches.

**Acceptance:** utility/error routes are absent from the sitemap and return noindex; public event pages
do not inherit profile response headers; privacy regression tests remain green.

### SEO-10 — SSR, prerender, cache, and performance verification

**Requirements:** NFR-1, NFR-10, NFR-12. **Depends on:** SEO-02 through SEO-08.

- Verify meaningful HTML, headings, links, and metadata before hydration for all public routes.
- Configure TanStack Start's Vite plugin with `prerender.enabled: true` and `crawlLinks: true` for the
  stable public route set, with an explicit filter for indexable pages. Treat route-level
  `staticData` as application data, not as prerender evidence.
- Produce a deterministic prerender route inventory from sitemap data; a route `staticData` flag alone
  is not evidence that dynamic D1 pages were generated.
- Add safe cache headers for public documents and short revalidation where freshness permits. Keep
  profile/account/private responses `private, no-store`.
- Enable TanStack Start's `responseLinkHeader` fallback from `apps/ui/src/server.ts` for
  locale-prefixed public HTML routes only. Forward only same-origin, immutable `/assets/` preload
  and modulepreload links, and remove `Link` hints from redirects, errors, and non-HTML responses.
  Do not preload the lazy Mapbox bundle or emit hints for private, utility, profile, or redirect
  routes. The Cloudflare zone Early Hints setting must be enabled so Cloudflare can turn the final
  `Link` headers into cached HTTP 103 responses; no Worker-specific 103 adapter is required.
- Run Lighthouse and Web Vitals for Arabic RTL and French/English LTR pages, including mobile.

Implementation evidence: cache-busted 2026-09-13 PageSpeed Insights runs against staging
`/ar/algeria` measured 95 mobile performance (FCP 1.9s, LCP 2.7s, TBT 0ms, CLS 0.03) and 100
desktop performance (FCP 0.4s, LCP 0.6s, TBT 20ms, CLS 0.001). The market hero serves dedicated
mobile and 1440px desktop WebP variants, the hydrated event feed seeds its query from SSR data,
and the non-critical service-worker registration is loaded after the initial route bundle. SEO
scores remain intentionally reduced on staging because `X-Robots-Tag: noindex, nofollow` is active.
The remaining Lighthouse advisories are non-blocking: the shared 38 KiB-gzip stylesheet is
render-blocking and the route bundle has about 44 KiB of unused JavaScript. The stylesheet remains
blocking until a separately tested critical-CSS split is available, avoiding a flash of unstyled
content.

**Acceptance:** p95 public response budget is met; primary content exists without JavaScript; prerender
inventory matches sitemap policy; only public HTML responses carry cache-safe `Link` hints; no private
page is publicly cached.

### SEO-11 — Automated regression suite and release gate

**Requirements:** NFR-1, NFR-4, NFR-7, NFR-12. **Depends on:** all implementation tickets.

**Status:** Implemented and staging-verified on 2026-09-13. Dynamic city/event coverage is reported
as empty when the staging D1 has no public rows; no test fixtures are written to staging.

- Add unit tests for URL building, locale alternates, description normalization, sitemap inclusion,
  and JSON-LD mapping.
- Add Miniflare integration tests for headers, robots, sitemap, redirects, and SSR documents.
- Add a local/staging SEO smoke for all public route classes and locales. Keep E2E outside CI per the
  existing project decision.
- Publish the generated sitemap and a machine-readable SEO route report as CI artifacts.

Implementation evidence: `apps/ui/integration/seo.integration.test.ts` runs against Miniflare with the
real Worker entrypoint and migrated D1; `tools/seo/smoke.mjs` probes the deployed origin and writes both
artifacts; `.github/workflows/ci.yml` runs the integration gate and `.github/workflows/deploy.yml`
uploads the staging/production smoke artifacts. Staging CI probes the deployed `workers.dev` hostname
while asserting `staging.founders.coffee` canonicals, avoiding a custom-domain WAF challenge on hosted
runners. The 2026-09-13 staging run passed all 18 discovered
static routes and utility checks (3 market routes, 15 company routes, zero dynamic rows). Playwright
remains outside CI as decided.

**Acceptance:** sync, typecheck, lint/boundaries, tests, and build pass; staging smoke passes; E2E
remains excluded from CI.

### SEO-12 — Search-engine operations and documentation closure

**Requirements:** NFR-1, NFR-12. **Depends on:** SEO-11.

- Register production in Google Search Console and Bing Webmaster Tools and submit the sitemap.
- Submit representative market, city, event, and company URLs for indexing.
- Monitor coverage, canonical selection, rich-result errors, crawl stats, Core Web Vitals, and 404s.
- Document the URL, locale, sitemap, staging-noindex, and rollback contracts in the deployment runbook.
- Add dated evidence before changing any roadmap status to Complete.

**Acceptance:** ownership is verified, sitemap processing succeeds, representative URLs are discovered
without canonical conflicts, and a 30-day monitoring review is scheduled.

## 5. Sequence and dependencies

1. SEO-01 establishes environment-aware indexation and origin safety.
2. SEO-02 fixes canonical and redirect behavior before new URLs are exposed.
3. SEO-03 introduces stable locale URLs and alternate links.
4. SEO-04 publishes the authoritative crawl inventory.
5. SEO-05 centralizes metadata and removes inherited homepage values.
6. SEO-06 adds page-appropriate structured data.
7. SEO-07 adds social previews.
8. SEO-08 makes long event collections crawlable.
9. SEO-09 closes utility, error, and privacy leaks.
10. SEO-10 verifies SSR, prerender, cache, and performance behavior.
11. SEO-11 adds the automated release gate.
12. SEO-12 completes search-engine submission and monitoring.

SEO-01 through SEO-04 are the first implementation slice. SEO-03 is the only ticket that changes the
public URL shape and requires a redirect map and staging rehearsal. SEO-07 can ship with a static
branded image; dynamic Browser Rendering cards remain future work.

## 6. Test matrix

| Dimension      | Required coverage                                                                        |
| -------------- | ---------------------------------------------------------------------------------------- |
| Environment    | local, staging, production configuration validation                                      |
| Locale         | `ar`/RTL, `fr`/LTR, `en`/LTR; no-cookie and locale-cookie requests                       |
| URL class      | market, city with events, empty city, event, company, profile, login, host creation, 404 |
| Content state  | upcoming, past, canceled, no description, long Unicode description, missing address      |
| Crawl behavior | robots, sitemap XML, redirects, one canonical, noindex response headers                  |
| Rendering      | SSR before hydration, JavaScript-disabled crawl, hydrated load-more behavior             |
| Privacy        | hidden fields absent from head, JSON-LD, OG/Twitter, sitemap, and cache                  |
| Quality gates  | format, typecheck, lint/boundaries, Miniflare integration, build, staging smoke          |

## 7. Rollout and rollback

1. Deploy SEO-01/02 to staging and confirm no production URL is emitted from staging.
2. Deploy locale routes and redirects behind a reversible routing switch; compare redirect chains and
   sitemap URLs before enabling production indexing.
3. Publish sitemap and metadata changes together so crawlers receive one consistent contract.
4. Submit the sitemap only after production responses, canonicals, and hreflang pass the smoke.
5. If a regression appears, restore the previous metadata/sitemap version, keep staging noindex, and
   remove only new locale redirects after preserving legacy URL responses.

## 8. Definition of done

- [ ] Every code change references an SEO ticket and SRS requirement.
- [ ] Production/staging origin and indexation policies are environment-aware and tested.
- [ ] Every indexable document has exactly one correct canonical and matching OG/JSON-LD URL.
- [ ] `ar`, `fr`, and `en` have stable public URLs with reciprocal hreflang.
- [ ] Production sitemap is valid, complete, deterministic, and referenced by robots.
- [ ] Market, city, event, and company metadata is localized, unique, and non-empty.
- [ ] Event, collection, breadcrumb, and organization structured data validates.
- [ ] Social images are available without exposing private or staging assets.
- [ ] Long event lists remain crawlable without JavaScript.
- [ ] Utility, error, and private profile pages are excluded from indexing and public caches.
- [ ] SSR, prerender inventory, response time, and Core Web Vitals are verified.
- [x] Unit/integration/build gates pass; E2E remains outside CI as decided.
- [ ] Search Console/Bing submission and monitoring ownership are documented.
