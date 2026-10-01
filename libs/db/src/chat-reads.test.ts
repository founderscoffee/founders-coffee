import { beforeAll, describe, expect, it } from 'vitest';

import { getChatChannel } from './chat-channels.js';
import { markChatRead, setChatMuted } from './chat-members.js';
import { readChatMessages, readChatPage } from './chat-reads.js';
import {
  givePhoto,
  going,
  newMember,
  publishMeetup,
  setAccount,
  writeMessage,
} from './chat.fixtures.js';
import type { Db } from './index.js';
import { HOST_ID, setupDb } from './rsvps.fixtures.js';

const AT = Date.parse('2099-01-10T09:00:00Z');

const messageId = (n: number) => `msg_${String(n).padStart(32, '0')}`;

const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id);

describe('readChatMessages (real D1)', () => {
  let db: Db;
  let eventId: string;

  beforeAll(async () => {
    db = await setupDb();
    eventId = await publishMeetup(db);
    const channelId = (await getChatChannel(db, eventId))?.id ?? '';
    const other = await getChatChannel(db, await publishMeetup(db));
    for (const n of [1, 2, 3, 4, 5, 6]) {
      await writeMessage(db, {
        channelId,
        authorId: n === 4 ? null : HOST_ID,
        kind: n === 4 ? 'system' : 'text',
        id: messageId(n),
        createdAt: AT + Math.min(n, 5) * 1000,
      });
    }
    await writeMessage(db, {
      channelId: other?.id ?? '',
      authorId: HOST_ID,
      createdAt: AT + 3500,
    });
  });

  const read = (
    page: Omit<Parameters<typeof readChatMessages>[1], 'eventId'>,
  ) => readChatMessages(db, { eventId, ...page });

  it('opens on the latest page, oldest first, and says there are older ones', async () => {
    const page = await read({ viewerId: HOST_ID, limit: 3 });

    expect(ids(page.messages)).toEqual([4, 5, 6].map(messageId));
    expect(page.hasMore).toBe(true);
  });

  it('pages back from the oldest message a reader holds', async () => {
    const page = await read({
      viewerId: HOST_ID,
      before: { at: AT + 4000, id: messageId(4) },
      limit: 2,
    });

    expect(ids(page.messages)).toEqual([2, 3].map(messageId));
    expect(page.hasMore).toBe(true);
  });

  it('reads forward from the newest message a reader holds, after a reconnect', async () => {
    const page = await read({
      viewerId: HOST_ID,
      after: { at: AT + 2000, id: messageId(2) },
      limit: 2,
    });

    expect(ids(page.messages)).toEqual([3, 4].map(messageId));
    expect(page.hasMore).toBe(true);
  });

  it('breaks a tie in time by id, on both sides of a cursor', async () => {
    const newer = await read({
      viewerId: HOST_ID,
      after: { at: AT + 5000, id: messageId(5) },
      limit: 10,
    });
    const older = await read({
      viewerId: HOST_ID,
      before: { at: AT + 5000, id: messageId(6) },
      limit: 1,
    });

    expect(ids(newer.messages)).toEqual([messageId(6)]);
    expect(newer.hasMore).toBe(false);
    expect(ids(older.messages)).toEqual([messageId(5)]);
  });

  it('keeps every page to its own chat', async () => {
    const page = await read({ viewerId: HOST_ID, limit: 50 });

    expect(ids(page.messages)).toEqual([1, 2, 3, 4, 5, 6].map(messageId));
    expect(page.hasMore).toBe(false);
  });

  it('gives someone outside the chat no messages, and says so', async () => {
    const stranger = await newMember(db);

    const page = await read({ viewerId: stranger, limit: 50 });

    expect(page.messages).toEqual([]);
    expect(page.access).toMatchObject({ isMember: false });
  });
});

describe('readChatPage (real D1)', () => {
  let db: Db;

  beforeAll(async () => {
    db = await setupDb();
  });

  it("reads the chat, its latest messages with their authors, and the reader's own state", async () => {
    const eventId = await publishMeetup(db);
    const channel = await getChatChannel(db, eventId);
    const member = await newMember(db, { name: 'Amina' });
    await going(db, eventId, member);
    await givePhoto(db, member, 'ast_chat_amina');
    const written = await writeMessage(db, {
      channelId: channel?.id ?? '',
      authorId: member,
      createdAt: Date.now() - 1000,
    });
    await markChatRead(db, { eventId, userId: member, at: Date.now() });
    await setChatMuted(db, { eventId, userId: member, muted: true });

    const page = await readChatPage(db, {
      eventId,
      viewerId: member,
      limit: 50,
    });

    expect(page.access).toMatchObject({
      marketCode: 'DZ',
      hostId: HOST_ID,
      channelId: channel?.id,
      readOnlyAt: channel?.readOnlyAt,
      isMember: true,
    });
    expect(page.messages).toMatchObject([
      {
        id: written,
        authorId: member,
        authorName: 'Amina',
        authorPhotoAssetId: 'ast_chat_amina',
      },
    ]);
    expect(page.hasOlder).toBe(false);
    expect(page.member?.muted).toBe(true);
    expect(page.member?.lastReadAt).toBeInstanceOf(Date);
  });

  it('says whether there are older messages than the page', async () => {
    const eventId = await publishMeetup(db);
    const channelId = (await getChatChannel(db, eventId))?.id ?? '';
    for (const n of [1, 2, 3])
      await writeMessage(db, {
        channelId,
        authorId: HOST_ID,
        createdAt: AT + n,
      });

    const page = await readChatPage(db, {
      eventId,
      viewerId: HOST_ID,
      limit: 2,
    });

    expect(page.messages).toHaveLength(2);
    expect(page.hasOlder).toBe(true);
    expect(page.member).toBeUndefined();
  });

  it('names nobody whose account is banned, and shows no photo of them', async () => {
    const eventId = await publishMeetup(db);
    const channelId = (await getChatChannel(db, eventId))?.id ?? '';
    const banned = await newMember(db, { name: 'Banned Member' });
    await givePhoto(db, banned, 'ast_chat_banned');
    await writeMessage(db, { channelId, authorId: banned, createdAt: AT });
    await setAccount(db, banned, { banned: true });

    const page = await readChatPage(db, {
      eventId,
      viewerId: HOST_ID,
      limit: 50,
    });

    expect(page.messages).toMatchObject([
      { authorId: banned, authorName: null, authorPhotoAssetId: null },
    ]);
  });

  it('reads nothing of a chat for someone outside it', async () => {
    const eventId = await publishMeetup(db);
    const channelId = (await getChatChannel(db, eventId))?.id ?? '';
    await writeMessage(db, { channelId, authorId: HOST_ID, createdAt: AT });
    const stranger = await newMember(db);

    const page = await readChatPage(db, {
      eventId,
      viewerId: stranger,
      limit: 50,
    });

    expect(page.access?.isMember).toBe(false);
    expect(page.messages).toEqual([]);
  });

  it('answers with no access at all for a meetup that is not there', async () => {
    const page = await readChatPage(db, {
      eventId: 'evt_never_published',
      viewerId: HOST_ID,
      limit: 50,
    });

    expect(page.access).toBeUndefined();
    expect(page.messages).toEqual([]);
  });
});
