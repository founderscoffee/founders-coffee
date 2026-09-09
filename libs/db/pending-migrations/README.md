# PF-03 staged residence contraction

`0021_remove_profile_residence.sql` was generated from the Drizzle schema; its
generated rebuild was adapted for D1's enforced foreign keys. Direct column drops
fail because the legacy home-market FK is a table constraint. Deferral alone does
not disable cascades ([Cloudflare reference](https://developers.cloudflare.com/d1/sql-api/sql-statements/#pragma-defer_foreign_keys--onoff)). The migration therefore preserves every
cascade-dependent table in transaction-local copies, rebuilds only `user`, restores
the dependent rows, then drops all copies in the same migration transaction. Never
split this SQL into separate executions. The generated snapshot and journal stay in `migrations/meta`.
Database integration tests include this pending migration and rehearse populated D1.

This directory is deliberately **not** configured as Wrangler's migrations directory.
Deploying PF-03 first stops selecting, writing and serializing residence fields while
remaining compatible with the additive schema through 0020. A normal push must not
drop fields before that compatible code is live in every Worker.

Promotion is **PF-03b** in the profile plan — a release ticket, not a code change, and one
nobody executes without the owner asking for it. After an operator verifies PF-03a in staging
and production, with the deployed Worker version, a D1 recovery point and a compatible rollback
version recorded, move this SQL file unchanged into `libs/db/migrations/` in that release. Run normal Wrangler migrations
from the canonical worker-jobs config. Wrangler records 0021 and will not reapply it.
Do not deploy pre-PF-03 Workers after contraction. Do not generate later schema changes
until 0021 has been promoted; its snapshot already represents the contracted schema. PF-03a adds a
test that enforces this — a journal tag whose `.sql` is missing from `migrations/` fails the build
once a later tag exists, so this paragraph stops being the only thing standing in the way.

No old residence values are copied into another table. Event geography, account
identities, sessions, RSVPs and profile data must survive. Legacy backup retention is
unchanged; the removal is from active account storage, not a promise to rewrite backups.
