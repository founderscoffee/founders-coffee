# founders.coffee

founders.coffee is an Arabic-first, multi-market community platform for informal founder meetups, sponsored community programs, and future hosted challenges. Community membership, events, participation, and ordinary hosting are free. Revenue comes from disclosed B2B sponsorships and commercial hosted-challenge services.

## Current product

The implemented member flow lives in `apps/ui`:

- market and city discovery;
- email-OTP login and OAuth UI, with phone-OTP support in the auth backend;
- onboarding and profiles;
- event creation, listing, detail, and RSVP;
- PWA push and notification-SMS provider foundations (push-first fallback orchestration is still blocked);
- live event attendance over Durable Object WebSockets;
- city waitlists and Arabic/French/English UI.

`apps/dashboard` is the future sponsor portal. `apps/admin` is the internal operations console and already includes its Cloudflare Access JWT guard, but both UIs remain incomplete. `apps/worker-jobs` runs background delivery, indexing, and reconciliation work.

## Architecture

This is an Nx 23 monorepo using TypeScript 6, TanStack Start, Cloudflare Workers, D1 with Drizzle, Better Auth, Zod, Tailwind CSS v4, DaisyUI, Vitest, Playwright, and Miniflare.

The enforced application flow is:

```text
component → hook → feature api.ts → server function → domain → repository → D1
```

Read these in order before changing code:

1. [`AGENTS.md`](./AGENTS.md) — binding engineering rules.
2. [`docs/srs.md`](./docs/srs.md) — approved product and architecture requirements.
3. [`docs/implementation-plan.md`](./docs/implementation-plan.md) — delivery status and sequencing.

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
npm run typecheck
npm run lint
npm run test
npx nx run public:e2e
```

Integration tests use real Miniflare bindings. Cloudflare bindings must not be mocked.

## Deployment

- Pushes to `develop` deploy staging after verification.
- Production deploys are manual and must run from `main`.
- D1 migrations run before Worker deployment.

See [`docs/ci.md`](./docs/ci.md), [`docs/provisioning.md`](./docs/provisioning.md), and [`docs/secrets.md`](./docs/secrets.md).
