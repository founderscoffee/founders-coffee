# Account requests

The privacy policy asks members to email **contact@founders.coffee**, from the address registered
on their account, to close it or to get a copy of their data. This is how the operator carries out
each request. The policy promises that a closed account's data is deleted within 30 days of its
closure, so close the account as soon as the sender is checked.

Run every command from `apps/worker-jobs`, where the D1 bindings are. The examples use production;
for staging, use `founders-coffee-db-staging` and `--env staging`.

## Before either request

1. **Check the sender.** The request must come from the address on the account. Answer only to
   that address, never to another one the message gives.
2. **Find the account.** This only reads:

   ```bash
   wrangler d1 execute founders-coffee-db-production --remote --env production \
     --command "SELECT id, name, email, account_state, closed_at, created_at FROM user WHERE email = 'member@example.com'"
   ```

   Addresses are stored in lower case, so write it that way. No row means there is no account:
   say so, and stop. Keep the `id`; every later step uses it.

## Closing an account (#105)

Nothing can be undone once the account is erased. If anything in the request is unclear, ask
before closing.

1. **Look at what they host.** Their meetups that have not ended:

   ```bash
   wrangler d1 execute founders-coffee-db-production --remote --env production \
     --command "SELECT id, title, starts_at, status FROM events WHERE host_id = 'usr_…' AND status = 'published' AND coalesce(ends_at, starts_at + 7200) > unixepoch()"
   ```

   The nightly run cancels each one that has not started, and everyone going gets the ordinary
   cancellation notice. One under way is left to end first. Say so in your reply to the member.

2. **Close the account.** From this moment the public sees neither their profile nor the meetups
   they host:

   ```bash
   wrangler d1 execute founders-coffee-db-production --remote --env production \
     --command "UPDATE user SET account_state = 'closing', closed_at = unixepoch() WHERE id = 'usr_…' AND email = 'member@example.com' AND account_state = 'active' RETURNING id, email"
   ```

   It must print the account back. Nothing printed means the id and the address do not belong
   together, or the account is not open: find the account again. Then sign them out:

   ```bash
   wrangler d1 execute founders-coffee-db-production --remote --env production \
     --command "DELETE FROM session WHERE user_id = 'usr_…'"
   ```

   Signing in again does not reopen the account; only the operator can, as below.

3. **Let the nightly run finish it.** `worker-jobs` runs at 03:00 UTC. For each closing account it
   cancels the meetups they host that have not started and gives back their seats at other hosts'
   meetups, which also takes them out of those meetups' Telegram groups. Then it deletes their
   photos from R2 and erases the account. It logs `account_closure` with the account id and one
   outcome:

   | Outcome               | Meaning                                                                                              |
   | --------------------- | ---------------------------------------------------------------------------------------------------- |
   | `erased`              | Done.                                                                                                |
   | `waiting_on_meetup`   | A meetup they host is under way. A later night finishes it.                                          |
   | `waiting_on_telegram` | They still hold a group invitation, or a Telegram job is queued for them. A later night finishes it. |
   | `reopened`            | The account was reopened before the erasure. Nothing was erased.                                     |

   A member in a meetup's Telegram group usually takes a second night: the first queues their
   removal, and the erasure waits until the bot has done it. `account_closure_overdue` is logged as
   an error for an account still waiting 25 days after it was closed: look at it before the 30 days
   run out.

4. **Confirm to the member**, from contact@founders.coffee, once the log says `erased`.

**Reopening.** Until the erasure, a member who changes their mind can have their account back:

```bash
wrangler d1 execute founders-coffee-db-production --remote --env production \
  --command "UPDATE user SET account_state = 'active', closed_at = NULL WHERE id = 'usr_…' AND account_state = 'closing' RETURNING id"
```

Meetups and seats the nightly run already gave up stay given up. After the erasure there is
nothing to reopen: signing in with the same address makes a new account.

**What the erasure keeps.** The `user` row stays as a tombstone, so every row that has to outlive
the account still points at something. It has no name or phone, an address nobody receives mail
at (`erased-<id>@erased.invalid`), no photo and no language. The rows that stay:

- the meetups they hosted, and the wrap-up they filed for each, which stay in the city's record
  with their name detached;
- their RSVPs and attendance, for the 24 months the policy gives them;
- their feedback ratings, without the comment;
- the records of moderation decisions: host trust, the operations audit and the weekly reviews.

Everything else that was theirs goes: profile, photos, preferences, devices, queued notices,
Telegram invitations, sessions, Google and GitHub links, pending sign-in codes, and waitlist
entries under their address. Orders and invoices, which belong to the dormant payments work, are
not touched; that has to change before payments open.

**Outside D1.** Rate-limit buckets delete themselves a day after their last use. Logs are not
rewritten; they age out with the retention Workers Logs gives them. A D1 Time Travel restore to a
point before an erasure brings the account back: after any restore, close again every account
whose `erased` outcome was logged after the restore point.

## Copying a member's data

Send the member what the platform holds about them, as JSON, to the address on the account. Each
query only reads; run each with `--json` and keep the outputs together.

```text
SELECT id, name, email, email_verified, phone_number, locale_pref, created_at FROM user WHERE id = 'usr_…'
SELECT * FROM member_profiles WHERE user_id = 'usr_…'
SELECT * FROM account_preferences WHERE user_id = 'usr_…'
SELECT provider_id, account_id, scope, created_at FROM account WHERE user_id = 'usr_…'
SELECT created_at, expires_at, ip_address, user_agent FROM session WHERE user_id = 'usr_…'
SELECT platform, surface, market_code, created_at FROM push_subscriptions WHERE user_id = 'usr_…'
SELECT id, title, description, venue, starts_at, status FROM events WHERE host_id = 'usr_…'
SELECT e.title, c.outcome, c.walk_in_count, c.would_host_again, c.host_friction, c.private_note, c.submitted_at FROM event_closeouts c JOIN events e ON e.id = c.event_id WHERE c.submitted_by_user_id = 'usr_…'
SELECT e.title, e.starts_at, r.status, r.created_at FROM event_rsvps r JOIN events e ON e.id = r.event_id WHERE r.user_id = 'usr_…'
SELECT e.title, a.outcome, a.recorded_at FROM event_attendance a JOIN events e ON e.id = a.event_id WHERE a.user_id = 'usr_…'
SELECT e.title, f.value_rating, f.would_return, f.comment, f.created_at FROM event_feedback f JOIN events e ON e.id = f.event_id WHERE f.user_id = 'usr_…'
SELECT e.title, i.telegram_user_id, i.created_at FROM event_telegram_invites i JOIN events e ON e.id = i.event_id WHERE i.user_id = 'usr_…'
SELECT market_code, status, reason_code, reviewed_at FROM host_trust WHERE user_id = 'usr_…'
SELECT market_code, city_code, locale, notified_at, created_at FROM city_waitlist WHERE email = 'member@example.com'
```

Leave out anything that would expose a secret or another person: session, provider and push
tokens, and other members' names. If the member has a photo, attach the original too. Its key is
the `object_key` of their `ready` row in `profile_assets`, followed by `/original`:

```bash
wrangler r2 object get founders-coffee-assets-production/profiles/pha_…/original \
  --remote --env production --file photo
```
