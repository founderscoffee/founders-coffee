import { beforeAll, describe, expect, it } from 'vitest';

import { getChatChannel } from './chat-channels.js';
import { markChatRead, setChatMuted } from './chat-members.js';
import { removeChatMessage, sendChatMessage } from './chat-messages.js';
import { readChatPage } from './chat-reads.js';
import { reportChatMessage } from './chat-reports.js';
import {
  going,
  newMember,
  publishMeetup,
  switchChat,
} from './chat.fixtures.js';
import type { Db } from './index.js';
import { HOST_ID, setupDb } from './rsvps.fixtures.js';

const send = (db: Db, eventId: string, authorId: string) =>
  sendChatMessage(db, {
    eventId,
    authorId,
    body: 'Salam',
    clientId: crypto.randomUUID(),
  });

describe('a chat its market has switched off (real D1)', () => {
  let db: Db;
  let eventId: string;
  let member: string;
  let messageId: string;

  beforeAll(async () => {
    db = await setupDb();
    eventId = await publishMeetup(db);
    member = await newMember(db);
    await going(db, eventId, member);
    const sent = await send(db, eventId, member);
    messageId = 'message' in sent ? sent.message.id : '';
    await switchChat(db, 'DZ', 'false');
  });

  it('takes no message, from a member or from the host', async () => {
    expect((await send(db, eventId, member)).outcome).toBe('not_member');
    expect((await send(db, eventId, HOST_ID)).outcome).toBe('not_member');
  });

  it('shows nobody what was said in it', async () => {
    const page = await readChatPage(db, {
      eventId,
      viewerId: HOST_ID,
      limit: 50,
    });

    expect(page.access?.isMember).toBe(false);
    expect(page.messages).toEqual([]);
  });

  it('takes no removal, read marker, mute or report', async () => {
    expect(
      await removeChatMessage(db, { messageId, actorId: member }),
    ).toBeUndefined();
    expect(
      await markChatRead(db, { eventId, userId: member, at: Date.now() }),
    ).toBe(false);
    expect(
      await setChatMuted(db, { eventId, userId: member, muted: true }),
    ).toBe(false);
    expect(
      await reportChatMessage(db, {
        messageId,
        reporterId: HOST_ID,
        reason: 'spam',
      }),
    ).toBe('refused');
  });

  it('still gives a meetup published meanwhile its chat, for when it is switched on', async () => {
    const later = await publishMeetup(db);

    expect(await getChatChannel(db, later)).toBeDefined();
  });

  it('counts only JSON true as switched on', async () => {
    await switchChat(db, 'DZ', '1');
    const numberOne = await send(db, eventId, member);
    await switchChat(db, 'DZ', 'true');
    const on = await send(db, eventId, member);

    expect(numberOne.outcome).toBe('not_member');
    expect(on.outcome).toBe('sent');
  });
});
