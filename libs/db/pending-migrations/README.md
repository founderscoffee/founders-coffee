# Staged profile contractions

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
Do not deploy pre-PF-03 Workers after contraction. Later generated migrations must remain
in this pending directory until their dependencies are promoted. The quarantine test rejects
any shipped migration following a pending journal entry; it permits a fully pending suffix.
Never promote a later migration ahead of an earlier one.

`0022_remove_photo_visibility.sql` is the user-requested PF-06 simplification. It drops only
`member_profiles.publish_photo`; avatars are public when uploaded, while optional text details
retain their publication controls. Deploy compatible code to every Worker before promoting
this migration, with a recovery point and compatible rollback version recorded. Code works
both before and after the drop; old Workers selecting this field cannot run after it.
Both contractions are rehearsed locally on populated D1. No remote database is modified by
preparing these files. Historical migrations/snapshots retain the old field as immutable history.

No old residence values are copied into another table. Event geography, account
identities, sessions, RSVPs and profile data must survive. Legacy backup retention is
unchanged; the removal is from active account storage, not a promise to rewrite backups.

`0023_simplify_profile_introduction.sql` is the PF-04 follow-up requested by the owner.
It drops only `introduction_locale` and `publish_introduction`, preserving introduction text.
Introductions are public when provided; other optional details remain opt-in. This change applies
to existing introductions too, so communicate the visibility change before rollout. Keep 0023
pending until 0021/0022 are promoted and compatible Workers are deployed everywhere. The local
populated-D1 test checks all remaining columns and foreign keys. Originals in migration history
remain immutable; do not edit old migrations or snapshots to remove historical field definitions.

`0024_remove_profile_community_role.sql` removes the user-requested self-description field and
its visibility flag. It does not touch `user.role`, permissions, or other profile data. Promote only
in journal order after 0021–0023 and compatible Worker deployment; the populated local test verifies
remaining profile values, auth rows and foreign keys. New interests and spoken languages use the
existing JSON columns and do not need a separate schema change.
