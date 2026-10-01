import { beforeEach, describe, expect, it } from 'vitest';

import { type Result } from '@founders-coffee/core';
import { cancelRsvp, type Db } from '@founders-coffee/db';

import {
  ban,
  endMeetupAgo,
  goingMember,
  HOST_ID,
  newMember,
  publishMeetup,
  setupDb,
} from './chat.fixtures.js';
import {
  listChatMessagesResolver,
  removeChatMessageResolver,
  sendChatMessageResolver,
} from './messages.js';

const DAY_SECONDS = 24 * 60 * 60;

const codeOf = (result: Result<unknown>) =>
  result.ok ? 'ok' : result.error.code;

describe('sending to a meetup chat (real D1 via Miniflare)', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  const send = (
    eventId: string,
    authorId: string,
    clientId: string = crypto.randomUUID(),
  ) =>
    sendChatMessageResolver(db, { eventId, authorId, body: 'Salam', clientId });

  it("posts a member's message as theirs, once however often it is retried", async () => {
    const eventId = await publishMeetup(db);
    const member = await goingMember(db, eventId, { name: 'Yacine' });
    const clientId = crypto.randomUUID();

    const first = await send(eventId, member, clientId);
    const retry = await send(eventId, member, clientId);

    if (!first.ok || !retry.ok) throw new Error('the send was refused');
    expect(retry.data.id).toBe(first.data.id);
    expect(first.data).toMatchObject({
      kind: 'text',
      body: 'Salam',
      removal: null,
      author: { id: member, name: 'Yacine', photoAssetId: null },
      isOwn: true,
      clientId,
    });
    const page = await listChatMessagesResolver(db, {
      eventId,
      viewerId: HOST_ID,
      limit: 50,
    });
    if (!page.ok) throw page.error;
    expect(page.data.messages).toMatchObject([
      { id: first.data.id, isOwn: false, clientId: null },
    ]);
  });

  it('refuses someone who is not going', async () => {
    const eventId = await publishMeetup(db);

    expect(codeOf(await send(eventId, await newMember(db)))).toBe(
      'chat_not_member',
    );
  });

  it('refuses a member who cancelled their RSVP', async () => {
    const eventId = await publishMeetup(db);
    const member = await goingMember(db, eventId);
    await cancelRsvp(db, { eventId, userId: member });

    expect(codeOf(await send(eventId, member))).toBe('chat_not_member');
  });

  it('refuses a banned member', async () => {
    const eventId = await publishMeetup(db);
    const member = await goingMember(db, eventId);
    await ban(db, member);

    expect(codeOf(await send(eventId, member))).toBe('chat_not_member');
  });

  it('refuses a message to a chat that has turned read-only', async () => {
    const eventId = await publishMeetup(db);
    const member = await goingMember(db, eventId);
    await endMeetupAgo(db, eventId, 8 * DAY_SECONDS);

    expect(codeOf(await send(eventId, member))).toBe('chat_read_only');
  });

  it('answers a meetup that has no chat', async () => {
    expect(codeOf(await send('evt_never_published', HOST_ID))).toBe(
      'chat_not_found',
    );
  });
});

describe("paging a chat's history (real D1 via Miniflare)", () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('pages back from the oldest message a member holds', async () => {
    const eventId = await publishMeetup(db);
    for (const body of ['un', 'deux', 'trois'])
      await sendChatMessageResolver(db, {
        eventId,
        authorId: HOST_ID,
        body,
        clientId: crypto.randomUUID(),
      });
    const all = await listChatMessagesResolver(db, {
      eventId,
      viewerId: HOST_ID,
      limit: 50,
    });
    if (!all.ok) throw all.error;
    const [, middle, newest] = all.data.messages;
    if (!middle || !newest) throw new Error('the chat is missing messages');

    const page = await listChatMessagesResolver(db, {
      eventId,
      viewerId: HOST_ID,
      before: { at: newest.createdAt.getTime(), id: newest.id },
      limit: 1,
    });

    if (!page.ok) throw page.error;
    expect(page.data.messages.map((message) => message.id)).toEqual([
      middle.id,
    ]);
    expect(page.data.hasMore).toBe(true);
  });

  it('refuses the history to someone who is not going', async () => {
    const eventId = await publishMeetup(db);

    expect(
      codeOf(
        await listChatMessagesResolver(db, {
          eventId,
          viewerId: await newMember(db),
          limit: 50,
        }),
      ),
    ).toBe('chat_not_member');
  });
});

describe('removing a message (real D1 via Miniflare)', () => {
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
      body: 'Oups',
      clientId: crypto.randomUUID(),
    });
    if (!sent.ok) throw sent.error;
    messageId = sent.data.id;
  });

  it('lets its author remove it', async () => {
    const removed = await removeChatMessageResolver(db, {
      messageId,
      actorId: author,
    });

    expect(removed).toEqual({
      ok: true,
      data: { id: messageId, removal: 'author' },
    });
  });

  it("lets the meetup's host remove it", async () => {
    const removed = await removeChatMessageResolver(db, {
      messageId,
      actorId: HOST_ID,
    });

    expect(removed.ok && removed.data.removal).toBe('host');
  });

  it('refuses another member, as if there were no such message', async () => {
    const other = await goingMember(db, eventId);

    expect(
      codeOf(
        await removeChatMessageResolver(db, { messageId, actorId: other }),
      ),
    ).toBe('chat_message_not_found');
    expect(
      codeOf(
        await removeChatMessageResolver(db, {
          messageId: 'msg_never_written',
          actorId: author,
        }),
      ),
    ).toBe('chat_message_not_found');
  });
});
