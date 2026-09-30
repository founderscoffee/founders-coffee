import { describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';

import { eraseClosedAccount } from './account-closure.js';
import { SOON, meetup, person, setupDb } from './account-closure.fixtures.js';
import {
  chatChannels,
  chatMembers,
  chatMessages,
  chatReports,
  eq,
  user,
  type Db,
} from './index.js';

const LATER = new Date('2099-01-01T00:00:00Z');

const message = async (db: Db, channelId: string, authorId: string) => {
  const messageId = id('msg');
  await db.insert(chatMessages).values({
    id: messageId,
    channelId,
    authorId,
    body: 'Salam',
    createdAt: new Date(),
  });
  return messageId;
};

const report = (
  db: Db,
  messageId: string,
  reporterId: string,
  reportedUserId: string,
) =>
  db.insert(chatReports).values({
    id: id('rpt'),
    messageId,
    reporterId,
    reportedUserId,
    marketCode: 'DZ',
    reason: 'spam',
  });

const closingMemberInAChat = async () => {
  const db = await setupDb();
  const host = await person(db, 'Rania');
  const member = await person(db, 'Yacine');
  const eventId = await meetup(db, host.id, SOON);
  const channelId = id('chn');
  await db.insert(chatChannels).values({
    id: channelId,
    eventId,
    marketCode: 'DZ',
    readOnlyAt: LATER,
    expiresAt: LATER,
  });
  const theirs = await message(db, channelId, member.id);
  const hosts = await message(db, channelId, host.id);
  await db.insert(chatMembers).values([
    { channelId, userId: member.id, muted: true },
    { channelId, userId: host.id, muted: false },
  ]);
  await report(db, hosts, member.id, host.id);
  await report(db, theirs, host.id, member.id);
  await db
    .update(user)
    .set({ accountState: 'closing', closedAt: new Date() })
    .where(eq(user.id, member.id));
  return { db, host, member, channelId, theirs, hosts };
};

const chatRows = async (db: Db, channelId: string) => ({
  messages: (
    await db
      .select({ id: chatMessages.id })
      .from(chatMessages)
      .where(eq(chatMessages.channelId, channelId))
  ).map((row) => row.id),
  members: (
    await db
      .select({ userId: chatMembers.userId })
      .from(chatMembers)
      .where(eq(chatMembers.channelId, channelId))
  ).map((row) => row.userId),
});

describe('erasing a closed account from the meetup chat (CH-09, real D1)', () => {
  it('deletes their messages and chat settings and no one else’s', async () => {
    const { db, host, member, channelId, hosts } = await closingMemberInAChat();

    expect(
      await eraseClosedAccount(db, {
        id: member.id,
        email: member.email,
        phoneNumber: null,
      }),
    ).toBe(true);

    expect(await chatRows(db, channelId)).toEqual({
      messages: [hosts],
      members: [host.id],
    });
  });

  it('keeps the reports they filed and the ones about them, on the tombstone', async () => {
    const { db, host, member, theirs, hosts } = await closingMemberInAChat();

    await eraseClosedAccount(db, {
      id: member.id,
      email: member.email,
      phoneNumber: null,
    });

    const reports = await db
      .select({
        messageId: chatReports.messageId,
        reporterId: chatReports.reporterId,
        reportedUserId: chatReports.reportedUserId,
      })
      .from(chatReports);
    expect(reports).toEqual(
      expect.arrayContaining([
        { messageId: hosts, reporterId: member.id, reportedUserId: host.id },
        { messageId: theirs, reporterId: host.id, reportedUserId: member.id },
      ]),
    );
  });

  it('leaves the chat of an account reopened in time as it was', async () => {
    const { db, member, channelId } = await closingMemberInAChat();
    await db
      .update(user)
      .set({ accountState: 'active', closedAt: null })
      .where(eq(user.id, member.id));
    const before = await chatRows(db, channelId);

    expect(
      await eraseClosedAccount(db, {
        id: member.id,
        email: member.email,
        phoneNumber: null,
      }),
    ).toBe(false);

    expect(await chatRows(db, channelId)).toEqual(before);
  });
});
