# Staged contractions

Empty, and that is the normal state. This directory holds migrations whose SQL is written and
reviewed but must not run until compatible code is live on every environment — a contraction that
lands ahead of its Workers takes the schema out from under them.

`0021`-`0024` (the PF-03 profile contractions) and `0025` (CO-03's operations schema, which followed
them in the journal and so had to wait) were promoted on 2026-09-10, after `v0.4.0` put PF-03a-
compatible code on staging and production and both Worker versions were recorded. They now live in
`libs/db/migrations/` with every other applied migration.

## When something belongs here

Put a generated migration here, not in `migrations/`, when either is true:

- it drops or rewrites a column that deployed code still reads, so the code has to ship first;
- an earlier migration is already pending, because journal order is absolute. `migration-quarantine.test.ts`
  rejects a shipped migration that follows a pending entry and permits a fully pending suffix, so a
  later additive migration has nowhere else to go while an earlier contraction waits.

Promotion is a release ticket, never a code change: record the deployed Worker version on every
environment, a D1 recovery point and the compatible rollback version, then move the file unchanged
into `libs/db/migrations/` and apply it through the canonical worker-jobs Wrangler config. Never
split a rebuild across separate executions, and never promote a later migration ahead of an earlier
one. Historical SQL and snapshots stay immutable.

After a contraction is promoted, do not deploy a Worker predating it.
