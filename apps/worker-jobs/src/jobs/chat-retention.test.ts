import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';
import {
  chatChannels,
  chatMessages,
  chatReports,
  createDb,
  createEventIfRouteAvailable,
  createRsvp,
  eq,
  reportChatMessage,
  seed,
  user,
  type Db,
} from '@founders-coffee/db';

import { sweepChatRetention } from './chat-retention.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const setupDb = async (): Promise<Db> => {
  const db = createDb(env.DB);
  await seed(db);
  return db;
};

const reportedChat = async (db: Db, n: number) => {
  const hostId = `usr_retention_host_${n}`;
  const memberId = `usr_retention_member_${n}`;
  await db.insert(user).values([
    { id: hostId, name: 'Host', email: `${hostId}@retention.test` },
    { id: memberId, name: 'Member', email: `${memberId}@retention.test` },
  ]);
  const eventId = id('evt');
  await createEventIfRouteAvailable(db, {
    id: eventId,
    slug: `chat-retention-${n}`,
    hostId,
    marketCode: 'DZ',
    stateCode: '16',
    cityCode: '1',
    title: `Retention ${n}`,
    description: 'Chat retention fixture.',
    venue: 'Café des Délices, Hydra',
    startsAt: new Date('2099-01-15T18:00:00Z'),
    endsAt: new Date('2099-01-15T20:00:00Z'),
    language: 'fr',
    status: 'published',
  });
  await createRsvp(db, { id: id('rsv'), eventId, userId: memberId });
  const [channel] = await db
    .select()
    .from(chatChannels)
    .where(eq(chatChannels.eventId, eventId));
  if (!channel) throw new Error('the meetup has no chat');
  const messageId = id('msg');
  await db.insert(chatMessages).values({
    id: messageId,
    channelId: channel.id,
    authorId: hostId,
    body: 'Salam',
    createdAt: new Date(),
  });
  await reportChatMessage(db, {
    messageId,
    reporterId: memberId,
    reason: 'spam',
  });
  return { channelId: channel.id, messageId };
};

describe('sweepChatRetention (real Miniflare D1)', () => {
  it('deletes the chats and the decided reports whose time has come', async () => {
    const db = await setupDb();
    const expired = await reportedChat(db, 1);
    const current = await reportedChat(db, 2);
    await db
      .update(chatChannels)
      .set({ expiresAt: new Date(Date.now() - DAY_MS) })
      .where(eq(chatChannels.id, expired.channelId));
    await db
      .update(chatReports)
      .set({
        status: 'dismissed',
        reviewedAt: new Date(Date.now() - 800 * DAY_MS),
      })
      .where(eq(chatReports.messageId, expired.messageId));

    expect(await sweepChatRetention(db)).toEqual({ chats: 1, reports: 1 });

    expect(
      await db
        .select({ id: chatChannels.id })
        .from(chatChannels)
        .where(eq(chatChannels.id, expired.channelId)),
    ).toEqual([]);
    expect(
      await db
        .select({ id: chatMessages.id })
        .from(chatMessages)
        .where(eq(chatMessages.id, expired.messageId)),
    ).toEqual([]);
    expect(
      await db.select({ messageId: chatReports.messageId }).from(chatReports),
    ).toEqual([{ messageId: current.messageId }]);
  });
});
