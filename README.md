# founders.coffee

founders.coffee is an Arabic-first community platform for informal local founder meetups. The first release is dedicated solely to building the community through free event discovery, hosting, RSVP, repeat participation, and trusted local relationships, starting with Algeria and an operational focus on Algiers.

Hackathons, sponsorship products, talent workflows, payments, and broader market expansion remain future roadmap work. They begin only after the community demonstrates durable density and repeat participation; if the community loop fails, later layers do not proceed. See the [release strategy](./docs/release-strategy.md).

## Current product

The implemented member flow lives in `apps/ui`:

- market and city discovery;
- email-OTP login and OAuth UI, with phone-OTP support in the auth backend;
- onboarding and profiles;
- event creation, listing, detail, and RSVP;
- PWA push and notification-SMS provider foundations (push-first fallback orchestration is still blocked);
- live event attendance over Durable Object WebSockets;
- city waitlists and Arabic/French/English UI.

`apps/dashboard` is a future sponsor portal and is not part of the current release. `apps/admin` is the internal operations console; only the moderation, trust, and operational capabilities needed to run the community belong to the current release. `apps/worker-jobs` runs background delivery and operational work.

## Architecture

This is an Nx 23 monorepo using TypeScript 6, TanStack Start, Cloudflare Workers, D1 with Drizzle, Better Auth, Zod, Tailwind CSS v4, DaisyUI, Vitest, Playwright, and Miniflare.

The enforced application flow is:

```text
component → hook → feature api.ts → server function → domain → repository → D1
```

Read these in order before changing code:

1. [`AGENTS.md`](./AGENTS.md) — binding engineering rules.
2. [`docs/srs.md`](./docs/srs.md) — approved product and architecture requirements.
3. [`docs/release-strategy.md`](./docs/release-strategy.md) — current community-only release boundary.
4. [`docs/implementation-plan.md`](./docs/implementation-plan.md) — delivery status and sequencing.

## Local development

Node.js 22 is required.

```sh
npm ci
npm run migrate:local
npm run ui:dev
```

The public app runs at `http://localhost:3000`. Copy the relevant `.dev.vars.example` file before exercising authentication, maps, or external providers.

## Quality gates

```sh
npx nx sync:check
npm run format:check
npm run typecheck
npm run lint
npm run test
npm run build
npx nx run public:e2e
```

The Playwright flow is currently a local/staging release gate and is intentionally excluded from
GitHub Actions. The CI gate covers formatting, typecheck, lint/boundaries, build, and non-E2E tests.

Integration tests use real Miniflare bindings. Cloudflare bindings must not be mocked.

## Deployment

- Pushes to `develop` deploy staging after verification.
- Production deploys are manual and must run from `main`.
- D1 migrations run before Worker deployment.

See [`docs/ci.md`](./docs/ci.md), [`docs/provisioning.md`](./docs/provisioning.md), and [`docs/secrets.md`](./docs/secrets.md).
