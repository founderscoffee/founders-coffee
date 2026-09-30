import { alias } from 'drizzle-orm/sqlite-core';
import { and, eq, inArray, ne, notExists, sql, type SQL } from 'drizzle-orm';

import { DEFAULT_LOCALE, LOCALES, type Locale } from '@founders-coffee/core';

import { isChatMember } from './chat-membership.js';
import type { Db } from './db.js';
import {
  accountPreferences,
  chatChannels,
  chatMembers,
  chatMessages,
  eventRsvps,
  events,
  markets,
  scheduledNotifications,
  user,
} from './schema.js';

export const CHAT_UNREAD_TITLE_SLOT = '\u0001title\u0001';

export type ChatUnreadNotice = {
  readonly sendAt: Date;
  readonly baseUrl: string;
  readonly content: Readonly<
    Record<Locale, { readonly title: string; readonly body: string }>
  >;
};

export type ChatUnreadStanding = 'unread' | 'read' | 'muted' | 'not_member';

export type ChatUnreadCount = {
  readonly eventId: string;
  readonly unread: number;
};

const localeList = sql`(${sql.join(
  LOCALES.map((locale) => sql`${locale}`),
  sql`, `,
)})`;

/**
 * The messages of the statement's chat that `readerId` has not read: text written by someone else,
 * still standing, after the read marker of the statement's `chat_members` row.
 *
 * A notice about the meetup is never unread. Its news reaches the members through its own push
 * and email, and counting it would tell a host about their own edit.
 */
const unreadBy = (
  readerId: string,
): SQL => sql`${chatMessages.channelId} = ${chatChannels.id}
  and ${chatMessages.kind} = 'text'
  and ${chatMessages.removedAt} is null
  and ${chatMessages.authorId} != ${readerId}
  and ${chatMessages.createdAt} > coalesce(${chatMembers.lastReadAt}, 0)`;

/**
 * Queue a `chat_unread` push, as one statement for a send's batch, for every member of the chat
 * of `eventId` who should hear of the message `messageId`.
 *
 * It writes only when this attempt wrote `messageId`, so a retry answered with the message its
 * first attempt stored queues nothing again. The recipients are the chat's members, by the rule
 * every read and write keeps, other than the author, who have not muted it and keep the chat's
 * push on, with push enabled on the account. Each gets at most one per unread stretch: none while
 * one is pending, and none again once one was queued after they last read, so a busy chat tells a
 * member once until they open it.
 *
 * Each push is written in its reader's language, their own or else the market's, from the three
 * versions in `notice.content`, and links to the meetup with its chat open. The database fills
 * in the meetup's title where `CHAT_UNREAD_TITLE_SLOT` stands, so the send needs no read first.
 */
export const queueChatUnread = (
  db: Db,
  input: {
    readonly eventId: string;
    readonly authorId: string;
    readonly messageId: string;
    readonly notice: ChatUnreadNotice;
  },
) => {
  const recipient = alias(user, 'chat_recipient');
  const earlier = alias(scheduledNotifications, 'earlier_notice');
  const locale = sql`case
    when ${recipient.localePref} in ${localeList} then ${recipient.localePref}
    when ${markets.defaultLocale} in ${localeList} then ${markets.defaultLocale}
    else ${DEFAULT_LOCALE} end`;
  const inLocale = (text: (locale: Locale) => string) =>
    sql`case ${locale} ${sql.join(
      LOCALES.map((each) => sql`when ${each} then ${text(each)}`),
      sql` `,
    )} end`;
  const { content, baseUrl, sendAt } = input.notice;
  const payload = sql`json_object(
    'eventTitle', ${events.title},
    'eventSlug', ${events.slug},
    'marketCode', ${events.marketCode},
    'startsAt', strftime('%Y-%m-%dT%H:%M:%fZ', ${events.startsAt}, 'unixepoch'),
    'venue', ${events.venue},
    'locale', ${locale},
    'pushTitle', replace(${inLocale((each) => content[each].title)}, ${CHAT_UNREAD_TITLE_SLOT}, ${events.title}),
    'pushBody', ${inLocale((each) => content[each].body)},
    'pushUrl', ${baseUrl} || '/' || ${locale} || '/' || ${markets.slug} || '/e/' || ${events.slug} || '?chat=true'
  )`;
  return db.insert(scheduledNotifications).select(
    db
      .select({
        id: sql<string>`'ntf_' || lower(hex(randomblob(16)))`.as('id'),
        eventId: events.id,
        userId: recipient.id,
        channel: sql<'push'>`'push'`.as('channel'),
        status: sql<'pending'>`'pending'`.as('status'),
        templateKey: sql<'chat_unread'>`'chat_unread'`.as('template_key'),
        payload: payload.as('payload'),
        sendAt: sql<number>`${Math.floor(sendAt.getTime() / 1000)}`.as(
          'send_at',
        ),
        attempts: sql<number>`0`.as('attempts'),
        lastError: sql<null>`null`.as('last_error'),
        fallbackChannel: sql<null>`null`.as('fallback_channel'),
        fallbackOf: sql<null>`null`.as('fallback_of'),
        claimedAt: sql<null>`null`.as('claimed_at'),
        dispatchStartedAt: sql<null>`null`.as('dispatch_started_at'),
        createdAt: sql<number>`unixepoch()`.as('created_at'),
        updatedAt: sql<number>`unixepoch()`.as('updated_at'),
      })
      .from(chatMessages)
      .innerJoin(chatChannels, eq(chatChannels.id, chatMessages.channelId))
      .innerJoin(events, eq(events.id, chatChannels.eventId))
      .innerJoin(markets, eq(markets.code, events.marketCode))
      .innerJoin(
        recipient,
        sql`${recipient.id} in (
          select ${events.hostId}
          union select ${eventRsvps.userId} from ${eventRsvps}
            where ${eventRsvps.eventId} = ${events.id} and ${eventRsvps.status} = 'going'
        )`,
      )
      .leftJoin(accountPreferences, eq(accountPreferences.userId, recipient.id))
      .leftJoin(
        chatMembers,
        and(
          eq(chatMembers.channelId, chatChannels.id),
          eq(chatMembers.userId, recipient.id),
        ),
      )
      .where(
        and(
          eq(chatMessages.id, input.messageId),
          eq(chatChannels.eventId, input.eventId),
          ne(recipient.id, input.authorId),
          isChatMember(sql`${recipient.id}`),
          sql`coalesce(${chatMembers.muted}, 0) = 0`,
          sql`(coalesce(${accountPreferences.meetupChatChannels}, 1) & 1) = 1`,
          sql`coalesce(${accountPreferences.pushEnabled}, 0) = 1`,
          notExists(
            db
              .select({ id: earlier.id })
              .from(earlier)
              .where(
                and(
                  eq(earlier.eventId, events.id),
                  eq(earlier.userId, recipient.id),
                  eq(earlier.templateKey, 'chat_unread'),
                  sql`(${earlier.status} = 'pending'
                    or ${earlier.createdAt} * 1000 > coalesce(${chatMembers.lastReadAt}, 0))`,
                ),
              ),
          ),
        ),
      ),
  );
};

/**
 * Whether a `chat_unread` push for `userId` should still go, read when it comes due: they are
 * still a member of the chat of `eventId`, have not muted it since, and something in it is unread.
 */
export const chatUnreadStanding = async (
  db: Db,
  input: { readonly eventId: string; readonly userId: string },
): Promise<ChatUnreadStanding> => {
  const rows = await db
    .select({
      isMember: sql<number>`${isChatMember(input.userId)}`,
      isMuted: sql<number>`coalesce(${chatMembers.muted}, 0)`,
      hasUnread: sql<number>`exists (select 1 from ${chatMessages} where ${unreadBy(input.userId)})`,
    })
    .from(chatChannels)
    .innerJoin(events, eq(events.id, chatChannels.eventId))
    .leftJoin(
      chatMembers,
      and(
        eq(chatMembers.channelId, chatChannels.id),
        eq(chatMembers.userId, input.userId),
      ),
    )
    .where(eq(chatChannels.eventId, input.eventId))
    .limit(1);
  const row = rows[0];
  if (!row?.isMember) return 'not_member';
  if (row.isMuted) return 'muted';
  return row.hasUnread ? 'unread' : 'read';
};

/**
 * How many messages `userId` has not read in each chat of `eventIds` they belong to. A chat they
 * do not belong to is left out, so the ids are a filter and never an authorisation. A muted chat
 * is counted as any other: muting stops the push, not the count.
 */
export const countUnreadChatMessages = async (
  db: Db,
  input: { readonly userId: string; readonly eventIds: readonly string[] },
): Promise<ChatUnreadCount[]> => {
  if (input.eventIds.length === 0) return [];
  return db
    .select({
      eventId: chatChannels.eventId,
      unread: sql<number>`(select count(*) from ${chatMessages} where ${unreadBy(input.userId)})`,
    })
    .from(chatChannels)
    .innerJoin(events, eq(events.id, chatChannels.eventId))
    .leftJoin(
      chatMembers,
      and(
        eq(chatMembers.channelId, chatChannels.id),
        eq(chatMembers.userId, input.userId),
      ),
    )
    .where(
      and(
        inArray(chatChannels.eventId, [...input.eventIds]),
        isChatMember(input.userId),
      ),
    );
};
