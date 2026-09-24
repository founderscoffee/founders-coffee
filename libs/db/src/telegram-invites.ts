import { and, eq, sql } from 'drizzle-orm';

import type { Db } from './db.js';
import {
  eventRsvps,
  eventTelegramGroups,
  eventTelegramInvites,
  scheduledNotifications,
  type EventTelegramInviteRow,
} from './schema.js';

export const getTelegramInvite = async (
  db: Db,
  opts: { eventId: string; userId: string },
): Promise<EventTelegramInviteRow | undefined> => {
  const rows = await db
    .select()
    .from(eventTelegramInvites)
    .where(
      and(
        eq(eventTelegramInvites.eventId, opts.eventId),
        eq(eventTelegramInvites.userId, opts.userId),
      ),
    )
    .limit(1);
  return rows[0];
};

/**
 * Keep a member's new invite link, unless they already have one for this meetup.
 *
 * Two taps can each ask Telegram for a link before either is stored. The unique pair decides which
 * one the member keeps, and the answer says whether this link lost, so the caller can revoke it
 * rather than leave a working link nobody will ever be let in by. `kept` is the row that stands,
 * which is absent only when a cancellation deleted the other one in between.
 */
export const saveTelegramInvite = async (
  db: Db,
  opts: {
    id: string;
    eventId: string;
    userId: string;
    inviteLink: string;
    now: Date;
  },
): Promise<{ written: boolean; kept: EventTelegramInviteRow | undefined }> => {
  const inserted = await db
    .insert(eventTelegramInvites)
    .values({
      id: opts.id,
      eventId: opts.eventId,
      userId: opts.userId,
      inviteLink: opts.inviteLink,
      createdAt: opts.now,
    })
    .onConflictDoNothing({
      target: [eventTelegramInvites.eventId, eventTelegramInvites.userId],
    })
    .returning();
  if (inserted[0]) return { written: true, kept: inserted[0] };
  return { written: false, kept: await getTelegramInvite(db, opts) };
};

/**
 * Decide a join request, and bind the invite to the Telegram account that sent it.
 *
 * The whole admission rule is one statement, so nothing can change between checking it and binding:
 * the link must be one this product issued, its member must still be going, and its meetup must
 * still be published with this chat as its active group. The account is bound on first use and
 * must match after that, so a forwarded link admits nobody but the member who used it first.
 * Answers the invite when the request should be approved.
 */
export const admitTelegramMember = async (
  db: Db,
  opts: { inviteLink: string; chatId: number; telegramUserId: number },
): Promise<EventTelegramInviteRow | undefined> => {
  const rows = await db
    .update(eventTelegramInvites)
    .set({ telegramUserId: opts.telegramUserId })
    .where(
      and(
        eq(eventTelegramInvites.inviteLink, opts.inviteLink),
        sql`(${eventTelegramInvites.telegramUserId} IS NULL OR ${eventTelegramInvites.telegramUserId} = ${opts.telegramUserId})`,
        sql`EXISTS (
          SELECT 1 FROM event_rsvps
          WHERE event_rsvps.event_id = ${eventTelegramInvites.eventId}
            AND event_rsvps.user_id = ${eventTelegramInvites.userId}
            AND event_rsvps.status = 'going'
        )`,
        sql`EXISTS (
          SELECT 1 FROM event_telegram_groups
          JOIN events ON events.id = event_telegram_groups.event_id
          WHERE event_telegram_groups.event_id = ${eventTelegramInvites.eventId}
            AND event_telegram_groups.status = 'active'
            AND event_telegram_groups.chat_id = ${opts.chatId}
            AND events.status = 'published'
        )`,
      ),
    )
    .returning();
  return rows[0];
};

/**
 * Remove a member's invite as their RSVP is withdrawn, and hand back what it held.
 *
 * Deleting and reading are one statement, so the link and the Telegram account id the removal needs
 * leave the table together, and a join request racing the cancellation finds nothing to admit.
 */
export const takeTelegramInvite = async (
  db: Db,
  opts: { eventId: string; userId: string },
): Promise<EventTelegramInviteRow | undefined> => {
  const rows = await db
    .delete(eventTelegramInvites)
    .where(
      and(
        eq(eventTelegramInvites.eventId, opts.eventId),
        eq(eventTelegramInvites.userId, opts.userId),
      ),
    )
    .returning();
  return rows[0];
};

export const listTelegramInvites = (
  db: Db,
  eventId: string,
): Promise<EventTelegramInviteRow[]> =>
  db
    .select()
    .from(eventTelegramInvites)
    .where(eq(eventTelegramInvites.eventId, eventId));

/** Remove every invite of a meetup and hand them back, so their links can still be revoked. */
export const deleteTelegramInvites = (
  db: Db,
  eventId: string,
): Promise<EventTelegramInviteRow[]> =>
  db
    .delete(eventTelegramInvites)
    .where(eq(eventTelegramInvites.eventId, eventId))
    .returning();

/**
 * Whether a Telegram account still belongs in a chat through any going member's invite.
 *
 * A host can run two meetups through one group, and someone who cancels one of them and is still
 * going to the other stays in it. A removal runs after the cancelled invite is gone, so the meetup
 * it came from counts too: an invite there now is one the member asked for again after coming
 * back, and they stay for that as well.
 */
export const isTelegramMemberOfChat = async (
  db: Db,
  opts: { chatId: number; telegramUserId: number },
): Promise<boolean> => {
  const rows = await db
    .select({ eventId: eventTelegramInvites.eventId })
    .from(eventTelegramInvites)
    .innerJoin(
      eventTelegramGroups,
      eq(eventTelegramGroups.eventId, eventTelegramInvites.eventId),
    )
    .innerJoin(
      eventRsvps,
      and(
        eq(eventRsvps.eventId, eventTelegramInvites.eventId),
        eq(eventRsvps.userId, eventTelegramInvites.userId),
        eq(eventRsvps.status, 'going'),
      ),
    )
    .where(
      and(
        eq(eventTelegramInvites.telegramUserId, opts.telegramUserId),
        eq(eventTelegramGroups.chatId, opts.chatId),
        eq(eventTelegramGroups.status, 'active'),
      ),
    )
    .limit(1);
  return rows.length > 0;
};

/**
 * Drop the Telegram account id from a removal once the removal is settled.
 *
 * The id is copied onto the row when the invite that held it is deleted, because the removal needs
 * it; after that it has no use, and the row is kept for the record.
 */
export const forgetTelegramAccount = async (
  db: Db,
  notificationId: string,
): Promise<void> => {
  await db
    .update(scheduledNotifications)
    .set({
      payload: sql`json_remove(${scheduledNotifications.payload}, '$.telegramUserId')`,
    })
    .where(eq(scheduledNotifications.id, notificationId));
};
