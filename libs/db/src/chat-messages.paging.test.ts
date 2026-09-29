import { beforeAll, describe, expect, it } from 'vitest';

import { getChatChannel } from './chat-channels.js';
import { listChatMessages } from './chat-messages.js';
import { publishMeetup, writeMessage } from './chat.fixtures.js';
import type { Db } from './index.js';
import { HOST_ID, setupDb } from './rsvps.fixtures.js';

const AT = Date.parse('2099-01-10T09:00:00Z');

const messageId = (n: number) => `msg_${String(n).padStart(32, '0')}`;

describe('listChatMessages (real D1)', () => {
  let db: Db;
  let channelId: string;

  beforeAll(async () => {
    db = await setupDb();
    const eventId = await publishMeetup(db);
    channelId = (await getChatChannel(db, eventId))?.id ?? '';
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

  const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

  it('opens on the latest page, oldest first', async () => {
    const page = await listChatMessages(db, { channelId, limit: 3 });

    expect(ids(page)).toEqual([messageId(4), messageId(5), messageId(6)]);
  });

  it('pages back from the oldest message a reader holds', async () => {
    const page = await listChatMessages(db, {
      channelId,
      before: { at: AT + 4000, id: messageId(4) },
      limit: 2,
    });

    expect(ids(page)).toEqual([messageId(2), messageId(3)]);
  });

  it('reads forward from the newest message a reader holds, after a reconnect', async () => {
    const page = await listChatMessages(db, {
      channelId,
      after: { at: AT + 2000, id: messageId(2) },
      limit: 2,
    });

    expect(ids(page)).toEqual([messageId(3), messageId(4)]);
  });

  it('breaks a tie in time by id, on both sides of a cursor', async () => {
    const newer = await listChatMessages(db, {
      channelId,
      after: { at: AT + 5000, id: messageId(5) },
      limit: 10,
    });
    const older = await listChatMessages(db, {
      channelId,
      before: { at: AT + 5000, id: messageId(6) },
      limit: 1,
    });

    expect(ids(newer)).toEqual([messageId(6)]);
    expect(ids(older)).toEqual([messageId(5)]);
  });

  it('keeps every page to its own chat', async () => {
    const page = await listChatMessages(db, { channelId, limit: 50 });

    expect(ids(page)).toEqual([1, 2, 3, 4, 5, 6].map(messageId));
  });
});
