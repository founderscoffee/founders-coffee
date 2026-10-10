# Development

Setting up founders.coffee locally, and the gates CI runs.

## Local development

Node.js 22.

```sh
npm ci
npm run migrate:local
npm run seed:local
npm run ui:dev
```

The public app runs at `http://localhost:3000`. Copy the relevant `.dev.vars.example` before
exercising authentication, maps, or external providers. [`CONTRIBUTING.md`](../CONTRIBUTING.md#local-setup)
has the full setup, including the features that need accounts of your own.

`seed:local` fills the local database with the three launch markets, three accounts and three
events, and is safe to re-run — every row yields to whatever is already there, so it never
overwrites something you changed by hand. The events exist so that each operations path has
something to run against: one has already ended and holds RSVPs, which is what the closeout and
feedback commands require; one is still ahead, because RSVP intent freezes at `startsAt`; one sits
in a second market. Sign in as `dev-host@dev.invalid`, `dev-member@dev.invalid` or
`dev-member-two@dev.invalid` — the addresses are unroutable, so the one-time code is written to the
dev server log rather than sent. The seed only ever writes to the local database and refuses
`--remote` and `--env`.

## Quality gates

```sh
npx nx sync:check      # committed tsconfig project references
npm run format:check
npm run typecheck
npm run lint           # includes the Nx module-boundary rules
npm run test
npm run build
npx nx run public:e2e  # Playwright — local/staging only, not in CI
```

Integration tests run against Miniflare with real local D1, Durable Object, Queue and Email
bindings. **Cloudflare bindings are never mocked.** The Playwright flow is deliberately a
local/staging release gate rather than a CI step.
