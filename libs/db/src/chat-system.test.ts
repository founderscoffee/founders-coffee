import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';

import { getChatChannel } from './chat-channels.js';
import { sendChatMessage } from './chat-messages.js';
import { readChatPage } from './chat-reads.js';
import { postChatSystemMessage } from './chat-system.js';
import {
  going,
  newMember,
  publishMeetup,
  switchChat,
} from './chat.fixtures.js';
import { transitionEventStatus } from './events.js';
import type { Db } from './index.js';
import { HOST_ID, setupDb } from './rsvps.fixtures.js';
import { chatChannels, chatMessages } from './schema.js';

const RESCHEDULED = {
  systemKey: 'rescheduled',
  systemParams: {
    startsAt: '2099-01-15T19:00:00.000Z',
    venue: 'Café des Délices',
  },
} as const;

const messagesIn = async (db: Db, eventId: string) => {
  const channel = await getChatChannel(db, eventId);
  if (!channel) return [];
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.channelId, channel.id));
};

describe('what a chat is told about its meetup (real D1)', () => {
  let db: Db;

  beforeAll(async () => {
    db = await setupDb();
  });

  it('writes a notice with no author and no body, for each member to read in their language', async () => {
    const eventId = await publishMeetup(db);

    const posted = await postChatSystemMessage(db, {
      eventId,
      ...RESCHEDULED,
    });

    expect(posted).toMatchObject({
      kind: 'system',
      authorId: null,
      body: '',
      systemKey: 'rescheduled',
      systemParams: RESCHEDULED.systemParams,
      clientId: null,
      removal: null,
      authorName: null,
    });
    expect(await messagesIn(db, eventId)).toHaveLength(1);
  });

  it('takes its place on the timeline after what the members said before it', async () => {
    const eventId = await publishMeetup(db);
    const member = await newMember(db);
    await going(db, eventId, member);
    await sendChatMessage(db, {
      eventId,
      authorId: member,
      body: 'Salam',
      clientId: crypto.randomUUID(),
    });

    await postChatSystemMessage(db, { eventId, ...RESCHEDULED });

    const page = await readChatPage(db, {
      eventId,
      viewerId: member,
      limit: 50,
    });
    expect(page.messages.map((message) => message.kind)).toEqual([
      'text',
      'system',
    ]);
  });

  it('writes the cancellation into the chat the cancellation has just turned read-only', async () => {
    const eventId = await publishMeetup(db);
    await transitionEventStatus(db, eventId, 'published', 'cancelled', {
      cancellationReason: 'Le café ferme.',
    });

    const posted = await postChatSystemMessage(db, {
      eventId,
      systemKey: 'cancelled',
      systemParams: { reason: 'Le café ferme.' },
    });

    expect(posted?.systemParams).toEqual({ reason: 'Le café ferme.' });
  });

  it('gives a meetup with no chat its chat, with the notice in it', async () => {
    const eventId = await publishMeetup(db);
    await db.delete(chatChannels).where(eq(chatChannels.eventId, eventId));

    const posted = await postChatSystemMessage(db, {
      eventId,
      ...RESCHEDULED,
    });

    expect(posted).toBeDefined();
    expect(await getChatChannel(db, eventId)).toBeDefined();
  });

  it('writes nothing for a meetup that is not there', async () => {
    expect(
      await postChatSystemMessage(db, {
        eventId: 'evt_0123456789abcdef0123456789abcdef',
        ...RESCHEDULED,
      }),
    ).toBeUndefined();
  });

  it('writes nothing where the market has not switched its chats on', async () => {
    const eventId = await publishMeetup(db);
    await switchChat(db, 'DZ', 'false');
    try {
      expect(
        await postChatSystemMessage(db, { eventId, ...RESCHEDULED }),
      ).toBeUndefined();
      expect(await messagesIn(db, eventId)).toEqual([]);
    } finally {
      await switchChat(db, 'DZ', 'true');
    }
  });

  it('is read by the host as by the people going', async () => {
    const eventId = await publishMeetup(db);
    await postChatSystemMessage(db, { eventId, ...RESCHEDULED });

    const page = await readChatPage(db, {
      eventId,
      viewerId: HOST_ID,
      limit: 50,
    });

    expect(page.messages.map((message) => message.systemKey)).toEqual([
      'rescheduled',
    ]);
  });
});
