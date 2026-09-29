import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { getChatChannel } from './chat-channels.js';
import {
  sendChatMessage,
  type SendChatMessageResult,
} from './chat-messages.js';
import {
  DAY_SECONDS,
  endMeetupAgo,
  going,
  meetupRow,
  newMember,
  publishMeetup,
  setAccount,
} from './chat.fixtures.js';
import { createEvent, transitionEventStatus } from './events.js';
import type { Db } from './index.js';
import { cancelRsvp } from './rsvps.js';
import { HOST_ID, setupDb } from './rsvps.fixtures.js';
import { chatMessages } from './schema.js';

const messageOf = (result: SendChatMessageResult) =>
  'message' in result ? result.message : undefined;

const send = (db: Db, eventId: string, authorId: string, body = 'Salam') =>
  sendChatMessage(db, {
    eventId,
    authorId,
    body,
    clientId: crypto.randomUUID(),
  });

const messagesIn = async (db: Db, eventId: string) => {
  const chat = await getChatChannel(db, eventId);
  if (!chat) return [];
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.channelId, chat.id));
};

describe('sendChatMessage (real D1)', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it("posts a going member's message once, however often it is retried", async () => {
    const eventId = await publishMeetup(db);
    const member = await newMember(db);
    await going(db, eventId, member);
    const input = {
      eventId,
      authorId: member,
      body: 'Salam, see you there',
      clientId: crypto.randomUUID(),
    };

    const first = await sendChatMessage(db, input);
    const retry = await sendChatMessage(db, input);

    expect(first.outcome).toBe('sent');
    expect(retry.outcome).toBe('already_sent');
    expect(messageOf(retry)?.id).toBe(messageOf(first)?.id);
    expect(messageOf(first)).toMatchObject({
      authorId: member,
      kind: 'text',
      body: 'Salam, see you there',
      clientId: input.clientId,
      removedAt: null,
    });
    expect(await messagesIn(db, eventId)).toHaveLength(1);
  });

  it('takes a client id reused in another chat as a new message there', async () => {
    const first = await publishMeetup(db);
    const second = await publishMeetup(db);
    const clientId = crypto.randomUUID();
    const input = { authorId: HOST_ID, body: 'Salam', clientId };

    const inFirst = await sendChatMessage(db, { ...input, eventId: first });
    const inSecond = await sendChatMessage(db, { ...input, eventId: second });

    expect(inSecond.outcome).toBe('sent');
    expect(messageOf(inSecond)?.id).not.toBe(messageOf(inFirst)?.id);
    expect(messageOf(inSecond)?.channelId).toBe(
      (await getChatChannel(db, second))?.id,
    );
  });

  it("lets the host post to their own meetup's chat", async () => {
    const eventId = await publishMeetup(db);

    expect((await send(db, eventId, HOST_ID)).outcome).toBe('sent');
  });

  it("stamps each message with the database's clock in milliseconds", async () => {
    const eventId = await publishMeetup(db);
    const before = Date.now();

    const first = messageOf(await send(db, eventId, HOST_ID));
    const second = messageOf(await send(db, eventId, HOST_ID));

    const at = first?.createdAt.getTime() ?? 0;
    expect(Math.abs(at - before)).toBeLessThan(60_000);
    expect(second?.createdAt.getTime()).toBeGreaterThanOrEqual(at);
  });

  it('refuses anyone who is not going, and writes nothing', async () => {
    const eventId = await publishMeetup(db);
    const stranger = await newMember(db);

    expect((await send(db, eventId, stranger)).outcome).toBe('not_member');
    expect(await messagesIn(db, eventId)).toHaveLength(0);
  });

  it('refuses a member who withdrew', async () => {
    const eventId = await publishMeetup(db);
    const member = await newMember(db);
    await going(db, eventId, member);
    await cancelRsvp(db, { eventId, userId: member });

    expect((await send(db, eventId, member)).outcome).toBe('not_member');
  });

  it('refuses a member who is banned or whose account is closing', async () => {
    const eventId = await publishMeetup(db);
    const banned = await newMember(db);
    const closing = await newMember(db);
    await going(db, eventId, banned);
    await going(db, eventId, closing);
    await setAccount(db, banned, { banned: true });
    await setAccount(db, closing, { accountState: 'closing' });

    expect((await send(db, eventId, banned)).outcome).toBe('not_member');
    expect((await send(db, eventId, closing)).outcome).toBe('not_member');
  });

  it('closes the chat to everyone once its host is banned', async () => {
    const host = await newMember(db, { role: 'host' });
    const eventId = await publishMeetup(db, { hostId: host });
    const member = await newMember(db);
    await going(db, eventId, member);
    await setAccount(db, host, { banned: true });

    expect((await send(db, eventId, member)).outcome).toBe('not_member');
    expect((await send(db, eventId, host)).outcome).toBe('not_member');
  });

  it('keeps taking messages in the week after the meetup', async () => {
    const eventId = await publishMeetup(db);
    const member = await newMember(db);
    await going(db, eventId, member);
    await endMeetupAgo(db, eventId, 6 * DAY_SECONDS);

    expect((await send(db, eventId, member)).outcome).toBe('sent');
  });

  it('refuses a message once the chat has turned read-only', async () => {
    const eventId = await publishMeetup(db);
    const member = await newMember(db);
    await going(db, eventId, member);
    await endMeetupAgo(db, eventId, 8 * DAY_SECONDS);

    expect((await send(db, eventId, member)).outcome).toBe('read_only');
    expect(await messagesIn(db, eventId)).toHaveLength(0);
  });

  it("refuses a message to a cancelled meetup's chat", async () => {
    const eventId = await publishMeetup(db);
    const member = await newMember(db);
    await going(db, eventId, member);
    await transitionEventStatus(db, eventId, 'published', 'cancelled');

    expect((await send(db, eventId, member)).outcome).toBe('read_only');
  });

  it('gives a meetup published without a chat its chat with its first message', async () => {
    const event = await createEvent(db, meetupRow());
    const member = await newMember(db);
    await going(db, event.id, member);

    const result = await send(db, event.id, member);

    expect(result.outcome).toBe('sent');
    expect(messageOf(result)?.channelId).toBe(
      (await getChatChannel(db, event.id))?.id,
    );
  });

  it('answers that there is no chat once its 90 days are over, or for no meetup', async () => {
    const event = await createEvent(db, meetupRow());
    const member = await newMember(db);
    await going(db, event.id, member);
    await endMeetupAgo(db, event.id, 100 * DAY_SECONDS);

    expect((await send(db, event.id, member)).outcome).toBe('chat_missing');
    expect(await getChatChannel(db, event.id)).toBeUndefined();
    expect((await send(db, 'evt_never_published', member)).outcome).toBe(
      'chat_missing',
    );
  });
});
