import {
  and,
  eq,
  gt,
  inArray,
  lte,
  ne,
  or,
  sql,
  type AnyColumn,
  type SQL,
} from 'drizzle-orm';

import { batch } from './atomic.js';
import type { Db } from './db.js';
import { ASSUMED_DURATION_SECONDS } from './events.js';
import {
  account,
  accountPreferences,
  chatMembers,
  chatMessages,
  cityWaitlist,
  eventFeedback,
  eventRsvps,
  events,
  eventTelegramInvites,
  memberProfiles,
  profileAssets,
  pushSessionLinks,
  pushSubscriptions,
  scheduledNotifications,
  session,
  user,
  verification,
} from './schema.js';

export interface ClosingAccount {
  readonly id: string;
  readonly email: string;
  readonly phoneNumber: string | null;
  readonly closedAt: Date | null;
}

const EMAIL_CODE_TYPES = ['sign-in', 'email-verification', 'forget-password'];

const seconds = (date: Date): number => Math.floor(date.getTime() / 1000);

/**
 * The address an erased account is left holding, which no one can receive mail at.
 *
 * `user.email` is unique and required, so the tombstone needs one of its own. `.invalid` is
 * reserved (RFC 2606), so no sign-in code can ever reach it, and the id keeps it unique.
 */
export const erasedEmail = (userId: string): string =>
  `erased-${userId}@erased.invalid`;

/**
 * Accounts whose closure is due, longest closed first.
 *
 * Reads only through `user_closing_index`, which holds the accounts still closing and nothing else:
 * the one narrow daily scan AGENTS.md §11.5 allows for retention.
 */
export const listClosingAccounts = (
  db: Db,
  opts: { now: Date; limit: number },
) =>
  db
    .select({
      id: user.id,
      email: user.email,
      phoneNumber: user.phoneNumber,
      closedAt: user.closedAt,
    })
    .from(user)
    .where(
      and(sql`${user.accountState} = 'closing'`, lte(user.closedAt, opts.now)),
    )
    .orderBy(user.closedAt)
    .limit(opts.limit);

/** The published meetups a member hosts that have not ended yet, soonest first. */
export const listUnfinishedHostedEvents = (
  db: Db,
  opts: { userId: string; now: Date },
): Promise<{ id: string; startsAt: Date }[]> =>
  db
    .select({ id: events.id, startsAt: events.startsAt })
    .from(events)
    .where(
      and(
        eq(events.hostId, opts.userId),
        eq(events.status, 'published'),
        sql`coalesce(${events.endsAt}, ${events.startsAt} + ${ASSUMED_DURATION_SECONDS}) > ${seconds(opts.now)}`,
      ),
    )
    .orderBy(events.startsAt);

/** Other hosts' published meetups a member is going to that have not started yet. */
export const listUpcomingRsvpEvents = async (
  db: Db,
  opts: { userId: string; now: Date },
): Promise<string[]> => {
  const rows = await db
    .select({ eventId: eventRsvps.eventId })
    .from(eventRsvps)
    .innerJoin(events, eq(events.id, eventRsvps.eventId))
    .where(
      and(
        eq(eventRsvps.userId, opts.userId),
        eq(eventRsvps.status, 'going'),
        eq(events.status, 'published'),
        ne(events.hostId, opts.userId),
        gt(events.startsAt, opts.now),
      ),
    );
  return rows.map((row) => row.eventId);
};

/**
 * Whether a meetup's Telegram group still waits on this member: an invite they hold, or a post or
 * a removal queued under them that has not gone out.
 *
 * Group posts are attributed to the host and a removal to the member leaving, so erasing either
 * while one is queued would take the job with it, and leave a member in a group they left.
 */
export const hasPendingTelegramWork = async (
  db: Db,
  userId: string,
): Promise<boolean> => {
  const [invites, queued] = await Promise.all([
    db
      .select({ id: eventTelegramInvites.id })
      .from(eventTelegramInvites)
      .where(eq(eventTelegramInvites.userId, userId))
      .limit(1),
    db
      .select({ id: scheduledNotifications.id })
      .from(scheduledNotifications)
      .where(
        and(
          eq(scheduledNotifications.userId, userId),
          eq(scheduledNotifications.channel, 'telegram'),
          inArray(scheduledNotifications.status, ['pending', 'processing']),
        ),
      )
      .limit(1),
  ]);
  return invites.length > 0 || queued.length > 0;
};

/** The storage prefix of every photo a member ever reserved, whatever its state. */
export const listProfileAssetPrefixes = async (
  db: Db,
  userId: string,
): Promise<string[]> => {
  const rows = await db
    .select({ objectKey: profileAssets.objectKey })
    .from(profileAssets)
    .where(eq(profileAssets.userId, userId));
  return rows.map((row) => `${row.objectKey}/`);
};

/**
 * Erase a closed account in one atomic batch, keeping what the privacy policy keeps (#105).
 *
 * The `user` row stays as a tombstone with nothing personal left on it: no name, an address no mail
 * reaches, no phone, no photo, no language. Every row that must outlive the account points at it,
 * so no foreign key blocks the erasure and nothing cascades. The host's meetups stay, their name
 * detached, as the city's record. RSVPs and attendance stay for the twenty-four months the policy
 * gives them, attributed to nobody. Feedback ratings stay without their comment. Host trust,
 * audit and review rows stay under their own retention, and so do meetup chat reports, the ones
 * they filed and the ones about their messages, pointing at the tombstone.
 *
 * Everything that is the member's own goes: profile, photo rows, preferences, devices, queued
 * notices, Telegram invites, meetup chat messages and chat settings, sessions, sign-in links with
 * Google or GitHub, codes still waiting for their address or phone, and the city waitlist entries
 * under their address. Photo bytes are the caller's to delete first, from
 * {@link listProfileAssetPrefixes}, since a deleted row is the only record of where they are.
 *
 * Every statement re-checks that the account is still closing, and the tombstone is written last,
 * so an account reopened in between is left exactly as it was. Returns whether it was erased.
 */
export const eraseClosedAccount = async (
  db: Db,
  closing: Pick<ClosingAccount, 'id' | 'email' | 'phoneNumber'>,
  now: Date = new Date(),
): Promise<boolean> => {
  const userId = closing.id;
  const stillClosing = sql`exists (select 1 from ${user} where ${user.id} = ${userId} and ${user.accountState} = 'closing')`;
  const owned = (column: AnyColumn): SQL =>
    and(eq(column, userId), stillClosing) as SQL;
  const codes = [
    ...EMAIL_CODE_TYPES.map((type) => `${type}-otp-${closing.email}`),
    ...(closing.phoneNumber
      ? [closing.phoneNumber, `${closing.phoneNumber}-request-password-reset`]
      : []),
  ];
  const changeOfAddress = `change-email-otp-${closing.email}-`;
  const results = await batch(db, [
    db.delete(memberProfiles).where(owned(memberProfiles.userId)),
    db.delete(profileAssets).where(owned(profileAssets.userId)),
    db.delete(accountPreferences).where(owned(accountPreferences.userId)),
    db.delete(pushSessionLinks).where(owned(pushSessionLinks.userId)),
    db.delete(pushSubscriptions).where(owned(pushSubscriptions.userId)),
    db
      .delete(scheduledNotifications)
      .where(owned(scheduledNotifications.userId)),
    db.delete(eventTelegramInvites).where(owned(eventTelegramInvites.userId)),
    db
      .update(eventFeedback)
      .set({ comment: null, commentLanguage: null, updatedAt: now })
      .where(owned(eventFeedback.userId)),
    db.delete(chatMessages).where(owned(chatMessages.authorId)),
    db.delete(chatMembers).where(owned(chatMembers.userId)),
    db.delete(session).where(owned(session.userId)),
    db.delete(account).where(owned(account.userId)),
    db
      .delete(verification)
      .where(
        and(
          or(
            inArray(verification.identifier, codes),
            sql`substr(${verification.identifier}, 1, length(${changeOfAddress})) = ${changeOfAddress}`,
          ),
          stillClosing,
        ),
      ),
    db
      .delete(cityWaitlist)
      .where(and(eq(cityWaitlist.email, closing.email), stillClosing)),
    db
      .update(user)
      .set({
        name: '',
        email: erasedEmail(userId),
        emailVerified: false,
        image: null,
        phoneNumber: null,
        phoneNumberVerified: false,
        localePref: null,
        role: 'member',
        banReason: null,
        accountState: 'deleted',
        updatedAt: now,
      })
      .where(and(eq(user.id, userId), eq(user.accountState, 'closing')))
      .returning({ id: user.id }),
  ]);
  const erased = results.at(-1) as { id: string }[];
  return erased.length > 0;
};
