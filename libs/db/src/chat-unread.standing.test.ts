import { beforeEach, describe, expect, it } from 'vitest';

import { markChatRead, setChatMuted } from './chat-members.js';
import { removeChatMessage, sendChatMessage } from './chat-messages.js';
import { postChatSystemMessage } from './chat-system.js';
import { chatUnreadStanding, countUnreadChatMessages } from './chat-unread.js';
import {
  going,
  newMember,
  publishMeetup,
  unreadNotice,
} from './chat.fixtures.js';
import type { Db } from './index.js';
import { cancelRsvp } from './rsvps.js';
import { HOST_ID, setupDb } from './rsvps.fixtures.js';

const send = async (db: Db, eventId: string, authorId: string) => {
  const result = await sendChatMessage(db, {
    eventId,
    authorId,
    body: 'Salam',
    clientId: crypto.randomUUID(),
    unread: unreadNotice(),
  });
  if (!('message' in result)) throw new Error(result.outcome);
  return result.message.id;
};

const RESCHEDULED = {
  systemKey: 'rescheduled',
  systemParams: { startsAt: '2099-01-16T18:00:00.000Z', venue: 'Café' },
} as const;

describe('a member’s unread messages in a meetup’s chat (real D1)', () => {
  let db: Db;
  let eventId: string;
  let member: string;

  beforeEach(async () => {
    db = await setupDb();
    eventId = await publishMeetup(db);
    member = await newMember(db);
    await going(db, eventId, member);
  });

  it('counts what others wrote since the member last read, and nothing of their own', async () => {
    await send(db, eventId, HOST_ID);
    await send(db, eventId, member);
    await send(db, eventId, HOST_ID);

    expect(
      await countUnreadChatMessages(db, {
        userId: member,
        eventIds: [eventId],
      }),
    ).toEqual([{ eventId, unread: 2 }]);
    expect(await chatUnreadStanding(db, { eventId, userId: member })).toBe(
      'unread',
    );

    await markChatRead(db, { eventId, userId: member, at: Date.now() });

    expect(
      await countUnreadChatMessages(db, {
        userId: member,
        eventIds: [eventId],
      }),
    ).toEqual([{ eventId, unread: 0 }]);
    expect(await chatUnreadStanding(db, { eventId, userId: member })).toBe(
      'read',
    );
  });

  it('never counts a notice about the meetup or a removed message', async () => {
    await postChatSystemMessage(db, { eventId, ...RESCHEDULED });
    const removed = await send(db, eventId, HOST_ID);
    await removeChatMessage(db, { messageId: removed, actorId: HOST_ID });

    expect(
      await countUnreadChatMessages(db, {
        userId: member,
        eventIds: [eventId],
      }),
    ).toEqual([{ eventId, unread: 0 }]);
    expect(await chatUnreadStanding(db, { eventId, userId: member })).toBe(
      'read',
    );
  });

  it('keeps counting a muted chat, whose push the standing stops', async () => {
    await send(db, eventId, HOST_ID);
    await setChatMuted(db, { eventId, userId: member, muted: true });

    expect(
      await countUnreadChatMessages(db, {
        userId: member,
        eventIds: [eventId],
      }),
    ).toEqual([{ eventId, unread: 1 }]);
    expect(await chatUnreadStanding(db, { eventId, userId: member })).toBe(
      'muted',
    );
  });

  it('answers for the member’s own chats only, whatever ids are asked about', async () => {
    const elsewhere = await publishMeetup(db);
    await send(db, elsewhere, HOST_ID);
    await send(db, eventId, HOST_ID);

    expect(
      await countUnreadChatMessages(db, {
        userId: member,
        eventIds: [eventId, elsewhere],
      }),
    ).toEqual([{ eventId, unread: 1 }]);
    expect(
      await chatUnreadStanding(db, { eventId: elsewhere, userId: member }),
    ).toBe('not_member');
    expect(
      await countUnreadChatMessages(db, { userId: member, eventIds: [] }),
    ).toEqual([]);
  });

  it('takes a member who cancelled as no member at all', async () => {
    await send(db, eventId, HOST_ID);
    await cancelRsvp(db, { eventId, userId: member });

    expect(await chatUnreadStanding(db, { eventId, userId: member })).toBe(
      'not_member',
    );
    expect(
      await countUnreadChatMessages(db, {
        userId: member,
        eventIds: [eventId],
      }),
    ).toEqual([]);
  });
});
