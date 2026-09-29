import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { idSchema } from '@founders-coffee/core';

import { getChatChannel } from './chat-channels.js';
import { removeChatMessage, sendChatMessage } from './chat-messages.js';
import { reportChatMessage } from './chat-reports.js';
import {
  going,
  newMember,
  publishMeetup,
  writeMessage,
} from './chat.fixtures.js';
import type { Db } from './index.js';
import { HOST_ID, setupDb } from './rsvps.fixtures.js';
import { chatReports } from './schema.js';

const post = async (db: Db, eventId: string, authorId: string) => {
  const result = await sendChatMessage(db, {
    eventId,
    authorId,
    body: 'A message to report',
    clientId: crypto.randomUUID(),
  });
  if (!('message' in result)) throw new Error(result.outcome);
  return result.message.id;
};

const reportsOf = (db: Db, messageId: string) =>
  db.select().from(chatReports).where(eq(chatReports.messageId, messageId));

describe('reportChatMessage (real D1)', () => {
  let db: Db;
  let eventId: string;
  let author: string;
  let reporter: string;
  let messageId: string;

  beforeEach(async () => {
    db = await setupDb();
    eventId = await publishMeetup(db);
    author = await newMember(db);
    reporter = await newMember(db);
    await going(db, eventId, author);
    await going(db, eventId, reporter);
    messageId = await post(db, eventId, author);
  });

  const report = (reporterId: string, id = messageId) =>
    reportChatMessage(db, { messageId: id, reporterId, reason: 'spam' });

  it("files a member's report in the review queue of the chat's market", async () => {
    expect(await report(reporter)).toBe('reported');

    const [filed] = await reportsOf(db, messageId);
    expect(filed).toMatchObject({
      reporterId: reporter,
      marketCode: 'DZ',
      reason: 'spam',
      status: 'open',
      reviewedBy: null,
      reviewedAt: null,
    });
    expect(idSchema.safeParse(filed?.id).success).toBe(true);
  });

  it('takes the market from the chat the message is in', async () => {
    const cairo = await publishMeetup(db, {
      marketCode: 'EG',
      stateCode: 'C',
      cityCode: '1',
    });
    await going(db, cairo, author);
    await going(db, cairo, reporter);
    const inCairo = await post(db, cairo, author);

    await report(reporter, inCairo);

    expect((await reportsOf(db, inCairo))[0]?.marketCode).toBe('EG');
  });

  it('takes one report per member for a message, whatever the reason', async () => {
    await report(reporter);

    expect(
      await reportChatMessage(db, {
        messageId,
        reporterId: reporter,
        reason: 'harassment',
      }),
    ).toBe('already_reported');
    expect(await reportsOf(db, messageId)).toMatchObject([{ reason: 'spam' }]);
  });

  it('takes a report from each member who makes one', async () => {
    expect(await report(reporter)).toBe('reported');
    expect(await report(HOST_ID)).toBe('reported');

    expect(await reportsOf(db, messageId)).toHaveLength(2);
  });

  it("refuses a report of the member's own message", async () => {
    expect(await report(author)).toBe('refused');
    expect(await reportsOf(db, messageId)).toHaveLength(0);
  });

  it('refuses a report of a message already removed', async () => {
    await removeChatMessage(db, { messageId, actorId: author });

    expect(await report(reporter)).toBe('refused');
  });

  it('refuses a report from someone outside the chat', async () => {
    expect(await report(await newMember(db))).toBe('refused');
  });

  it('refuses a report of a system message or of no message at all', async () => {
    const chat = await getChatChannel(db, eventId);
    const notice = await writeMessage(db, {
      channelId: chat?.id ?? '',
      authorId: null,
      kind: 'system',
      createdAt: Date.now(),
    });

    expect(await report(reporter, notice)).toBe('refused');
    expect(await report(reporter, 'msg_never_written')).toBe('refused');
  });
});
