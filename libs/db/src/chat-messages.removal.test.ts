import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { getChatChannel } from './chat-channels.js';
import { removeChatMessage, sendChatMessage } from './chat-messages.js';
import {
  going,
  newMember,
  publishMeetup,
  writeMessage,
} from './chat.fixtures.js';
import type { Db } from './index.js';
import { cancelRsvp } from './rsvps.js';
import { HOST_ID, setupDb } from './rsvps.fixtures.js';
import { chatMessages } from './schema.js';

const post = async (db: Db, eventId: string, authorId: string) => {
  const result = await sendChatMessage(db, {
    eventId,
    authorId,
    body: 'A message to remove',
    clientId: crypto.randomUUID(),
  });
  if (!('message' in result)) throw new Error(result.outcome);
  return result.message.id;
};

const stored = async (db: Db, messageId: string) => {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.id, messageId));
  return rows[0];
};

describe('removeChatMessage (real D1)', () => {
  let db: Db;
  let eventId: string;
  let member: string;

  beforeEach(async () => {
    db = await setupDb();
    eventId = await publishMeetup(db);
    member = await newMember(db);
    await going(db, eventId, member);
  });

  it('lets an author remove their own message, leaving its tombstone', async () => {
    const messageId = await post(db, eventId, member);

    const removed = await removeChatMessage(db, { messageId, actorId: member });

    expect(removed).toMatchObject({
      id: messageId,
      body: '',
      removal: 'author',
      removedBy: member,
    });
    expect(removed?.removedAt).toBeInstanceOf(Date);
    expect(removed).toEqual({ ...(await stored(db, messageId)), eventId });
  });

  it("lets the host remove a member's message, as the host", async () => {
    const messageId = await post(db, eventId, member);

    const removed = await removeChatMessage(db, {
      messageId,
      actorId: HOST_ID,
    });

    expect(removed).toMatchObject({ removal: 'host', removedBy: HOST_ID });
  });

  it('records the host removing their own message as its author', async () => {
    const messageId = await post(db, eventId, HOST_ID);

    const removed = await removeChatMessage(db, {
      messageId,
      actorId: HOST_ID,
    });

    expect(removed?.removal).toBe('author');
  });

  it('refuses another member, and leaves the message as it was', async () => {
    const messageId = await post(db, eventId, member);
    const other = await newMember(db);
    await going(db, eventId, other);
    const before = await stored(db, messageId);

    expect(
      await removeChatMessage(db, { messageId, actorId: other }),
    ).toBeUndefined();
    expect(await stored(db, messageId)).toEqual(before);
  });

  it('refuses an author who has left the chat', async () => {
    const messageId = await post(db, eventId, member);
    await cancelRsvp(db, { eventId, userId: member });

    expect(
      await removeChatMessage(db, { messageId, actorId: member }),
    ).toBeUndefined();
    expect((await stored(db, messageId))?.removedAt).toBeNull();
  });

  it('refuses the host of another meetup', async () => {
    const otherHost = await newMember(db, { role: 'host' });
    await publishMeetup(db, { hostId: otherHost });
    const messageId = await post(db, eventId, member);

    expect(
      await removeChatMessage(db, { messageId, actorId: otherHost }),
    ).toBeUndefined();
  });

  it('leaves a system message alone, even for the host', async () => {
    const chat = await getChatChannel(db, eventId);
    const messageId = await writeMessage(db, {
      channelId: chat?.id ?? '',
      authorId: null,
      kind: 'system',
      createdAt: Date.now(),
    });

    expect(
      await removeChatMessage(db, { messageId, actorId: HOST_ID }),
    ).toBeUndefined();
  });

  it('removes a message once, keeping who removed it first', async () => {
    const messageId = await post(db, eventId, member);
    await removeChatMessage(db, { messageId, actorId: member });

    expect(
      await removeChatMessage(db, { messageId, actorId: HOST_ID }),
    ).toBeUndefined();
    expect(await stored(db, messageId)).toMatchObject({
      removal: 'author',
      removedBy: member,
    });
  });
});
