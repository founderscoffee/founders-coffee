import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { getChatChannel } from './chat-channels.js';
import { setChatMuted } from './chat-members.js';
import { sendChatMessage } from './chat-messages.js';
import { reportChatMessage } from './chat-reports.js';
import {
  deleteExpiredChatReports,
  deleteExpiredChats,
  expiredChatIds,
  expiredChatReportIds,
} from './chat-retention.js';
import {
  DAY_SECONDS,
  endMeetupAgo,
  going,
  newMember,
  publishMeetup,
  unreadNotice,
} from './chat.fixtures.js';
import type { Db } from './index.js';
import { setupDb } from './rsvps.fixtures.js';
import {
  chatChannels,
  chatMembers,
  chatMessages,
  chatReports,
  events,
} from './schema.js';

const everything = { limit: 1_000 };

const planOf = async (query: { sql: string; params: unknown[] }) => {
  const plan = await env.DB.prepare(`EXPLAIN QUERY PLAN ${query.sql}`)
    .bind(...query.params)
    .all<{ detail: string }>();
  return plan.results.map((row) => row.detail).join(' | ');
};

const chatWithAMessage = async (db: Db) => {
  const eventId = await publishMeetup(db);
  const author = await newMember(db);
  const reporter = await newMember(db);
  await going(db, eventId, author);
  await going(db, eventId, reporter);
  const sent = await sendChatMessage(db, {
    eventId,
    authorId: author,
    body: 'Kept for ninety days',
    clientId: crypto.randomUUID(),
    unread: unreadNotice(),
  });
  if (!('message' in sent)) throw new Error(sent.outcome);
  await setChatMuted(db, { eventId, userId: reporter, muted: true });
  const channel = await getChatChannel(db, eventId);
  if (!channel) throw new Error('the meetup has no chat');
  return {
    eventId,
    channelId: channel.id,
    messageId: sent.message.id,
    author,
    reporter,
  };
};

const rowsIn = async (db: Db, channelId: string) => ({
  chats: await db
    .select()
    .from(chatChannels)
    .where(eq(chatChannels.id, channelId)),
  messages: await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.channelId, channelId)),
  members: await db
    .select()
    .from(chatMembers)
    .where(eq(chatMembers.channelId, channelId)),
});

describe('deleteExpiredChats (real D1)', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
    await deleteExpiredChats(db, { now: new Date(), ...everything });
  });

  it('deletes a chat 90 days after its meetup, with its messages and settings', async () => {
    const chat = await chatWithAMessage(db);
    await endMeetupAgo(db, chat.eventId, 91 * DAY_SECONDS);

    expect(
      await deleteExpiredChats(db, { now: new Date(), ...everything }),
    ).toBe(1);

    expect(await rowsIn(db, chat.channelId)).toEqual({
      chats: [],
      messages: [],
      members: [],
    });
    expect(
      await db.select().from(events).where(eq(events.id, chat.eventId)),
    ).toHaveLength(1);
  });

  it('keeps a chat until its 90 days have passed', async () => {
    const chat = await chatWithAMessage(db);
    await endMeetupAgo(db, chat.eventId, 89 * DAY_SECONDS);

    expect(
      await deleteExpiredChats(db, { now: new Date(), ...everything }),
    ).toBe(0);

    const kept = await rowsIn(db, chat.channelId);
    expect(kept.chats).toHaveLength(1);
    expect(kept.messages).toHaveLength(1);
    expect(kept.members).toHaveLength(1);
  });

  it('leaves the reports of a deleted chat for their own retention', async () => {
    const chat = await chatWithAMessage(db);
    await reportChatMessage(db, {
      messageId: chat.messageId,
      reporterId: chat.reporter,
      reason: 'harassment',
    });
    await endMeetupAgo(db, chat.eventId, 91 * DAY_SECONDS);

    await deleteExpiredChats(db, { now: new Date(), ...everything });

    expect(
      await db
        .select()
        .from(chatReports)
        .where(eq(chatReports.messageId, chat.messageId)),
    ).toMatchObject([
      {
        reporterId: chat.reporter,
        reportedUserId: chat.author,
        reason: 'harassment',
      },
    ]);
  });

  it('finds them through the index on when a chat expires', async () => {
    expect(
      await planOf(expiredChatIds(db, { now: new Date(), limit: 500 }).toSQL()),
    ).toMatch(/chat_channels_expires_at_index/);
  });

  it('deletes no more chats than its limit at a time', async () => {
    for (let n = 0; n < 3; n += 1) {
      const chat = await chatWithAMessage(db);
      await endMeetupAgo(db, chat.eventId, 91 * DAY_SECONDS);
    }

    expect(await deleteExpiredChats(db, { now: new Date(), limit: 2 })).toBe(2);
    expect(await deleteExpiredChats(db, { now: new Date(), limit: 2 })).toBe(1);
  });
});

describe('deleteExpiredChatReports (real D1)', () => {
  const NOW = new Date('2029-03-31T12:00:00Z');
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
    await deleteExpiredChatReports(db, { now: NOW, ...everything });
  });

  const reported = async (reviewedAt: Date | null) => {
    const chat = await chatWithAMessage(db);
    await reportChatMessage(db, {
      messageId: chat.messageId,
      reporterId: chat.reporter,
      reason: 'spam',
    });
    if (reviewedAt)
      await db
        .update(chatReports)
        .set({ status: 'dismissed', reviewedAt })
        .where(eq(chatReports.messageId, chat.messageId));
    return chat.messageId;
  };

  const reportsOf = (messageId: string) =>
    db.select().from(chatReports).where(eq(chatReports.messageId, messageId));

  it('deletes a report 24 months after its decision', async () => {
    const decided = await reported(new Date('2027-03-30T12:00:00Z'));

    expect(
      await deleteExpiredChatReports(db, { now: NOW, ...everything }),
    ).toBe(1);
    expect(await reportsOf(decided)).toEqual([]);
  });

  it('keeps a report decided less than 24 months ago', async () => {
    const decided = await reported(new Date('2027-04-01T12:00:00Z'));

    expect(
      await deleteExpiredChatReports(db, { now: NOW, ...everything }),
    ).toBe(0);
    expect(await reportsOf(decided)).toHaveLength(1);
  });

  it('finds them through the index on when a report was decided', async () => {
    expect(
      await planOf(expiredChatReportIds(db, { now: NOW, limit: 500 }).toSQL()),
    ).toMatch(/chat_reports_reviewed_at_index/);
  });

  it('keeps a report no one has decided on, however old it is', async () => {
    const open = await reported(null);

    await deleteExpiredChatReports(db, {
      now: new Date('2099-01-01T00:00:00Z'),
      ...everything,
    });

    expect(await reportsOf(open)).toMatchObject([{ status: 'open' }]);
  });
});
