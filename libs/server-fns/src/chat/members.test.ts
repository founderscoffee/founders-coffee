import { beforeEach, describe, expect, it } from 'vitest';

import { type Result } from '@founders-coffee/core';
import { type Db } from '@founders-coffee/db';

import {
  goingMember,
  HOST_ID,
  newMember,
  publishMeetup,
  setupDb,
} from './chat.fixtures.js';
import { markChatReadResolver, setChatMutedResolver } from './members.js';
import { sendChatMessageResolver } from './messages.js';
import { readChatPageResolver } from './page.js';
import { reportChatMessageResolver } from './reports.js';

const codeOf = (result: Result<unknown>) =>
  result.ok ? 'ok' : result.error.code;

describe("a member's own state in a chat (real D1 via Miniflare)", () => {
  let db: Db;
  let eventId: string;
  let member: string;

  beforeEach(async () => {
    db = await setupDb();
    eventId = await publishMeetup(db);
    member = await goingMember(db, eventId);
  });

  const stateOf = async (userId: string) => {
    const page = await readChatPageResolver(db, {
      eventId,
      viewerId: userId,
      now: new Date(),
    });
    if (!page.ok) throw page.error;
    return { lastReadAt: page.data.lastReadAt, muted: page.data.muted };
  };

  it('records how far a member has read, and whether they muted the chat', async () => {
    const at = Date.now() - 1000;

    expect(
      await markChatReadResolver(db, { eventId, userId: member, at }),
    ).toEqual({ ok: true, data: null });
    expect(
      await setChatMutedResolver(db, { eventId, userId: member, muted: true }),
    ).toEqual({ ok: true, data: { muted: true } });
    expect(await stateOf(member)).toEqual({
      lastReadAt: new Date(at),
      muted: true,
    });
  });

  it('refuses both to someone who is not going', async () => {
    const stranger = await newMember(db);

    expect(
      codeOf(
        await markChatReadResolver(db, {
          eventId,
          userId: stranger,
          at: Date.now(),
        }),
      ),
    ).toBe('chat_not_member');
    expect(
      codeOf(
        await setChatMutedResolver(db, {
          eventId,
          userId: stranger,
          muted: true,
        }),
      ),
    ).toBe('chat_not_member');
  });
});

describe('reporting a message (real D1 via Miniflare)', () => {
  let db: Db;
  let eventId: string;
  let author: string;
  let messageId: string;

  beforeEach(async () => {
    db = await setupDb();
    eventId = await publishMeetup(db);
    author = await goingMember(db, eventId);
    const sent = await sendChatMessageResolver(db, {
      eventId,
      authorId: author,
      body: 'Un message à signaler',
      clientId: crypto.randomUUID(),
    });
    if (!sent.ok) throw sent.error;
    messageId = sent.data.id;
  });

  it('files a report once, and answers a second one as the report it is', async () => {
    const report = () =>
      reportChatMessageResolver(db, {
        messageId,
        reporterId: HOST_ID,
        reason: 'harassment',
      });

    expect(await report()).toEqual({ ok: true, data: { status: 'reported' } });
    expect(await report()).toEqual({
      ok: true,
      data: { status: 'already_reported' },
    });
  });

  it("refuses a report of the member's own message, without saying why", async () => {
    expect(
      codeOf(
        await reportChatMessageResolver(db, {
          messageId,
          reporterId: author,
          reason: 'spam',
        }),
      ),
    ).toBe('chat_report_refused');
  });
});
