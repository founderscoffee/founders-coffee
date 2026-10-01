import { describe, expect, it } from 'vitest';

import {
  CHAT_PAGE_SIZE,
  listChatMessagesSchema,
  markChatReadSchema,
  reportChatMessageSchema,
  sendChatMessageSchema,
} from './schemas.js';

const EVENT_ID = 'evt_0123456789abcdef0123456789abcdef';
const MESSAGE_ID = 'msg_0123456789abcdef0123456789abcdef';
const CLIENT_ID = '5f0c7d2e-8a41-4b6e-9c3d-2e1f0a9b8c7d';

describe('the chat commands', () => {
  it('sends the body as the chat keeps it', () => {
    expect(
      sendChatMessageSchema.parse({
        eventId: EVENT_ID,
        body: '  see you\nat 10 ',
        clientId: CLIENT_ID,
      }),
    ).toEqual({
      eventId: EVENT_ID,
      body: 'see you at 10',
      clientId: CLIENT_ID,
    });
  });

  it('refuses a send without a client id that makes a retry write once', () => {
    expect(
      sendChatMessageSchema.safeParse({
        eventId: EVENT_ID,
        body: 'hello',
        clientId: 'retry-1',
      }).success,
    ).toBe(false);
  });

  it('refuses a field it does not know', () => {
    expect(
      sendChatMessageSchema.safeParse({
        eventId: EVENT_ID,
        body: 'hello',
        clientId: CLIENT_ID,
        authorId: 'usr_someone_else',
      }).success,
    ).toBe(false);
  });

  it('pages 50 messages unless asked for fewer, and never more', () => {
    expect(listChatMessagesSchema.parse({ eventId: EVENT_ID }).limit).toBe(
      CHAT_PAGE_SIZE,
    );
    expect(
      listChatMessagesSchema.safeParse({ eventId: EVENT_ID, limit: 51 })
        .success,
    ).toBe(false);
  });

  it('pages before a message or after one, not both', () => {
    const cursor = { at: 1_790_000_000_000, id: MESSAGE_ID };

    expect(
      listChatMessagesSchema.safeParse({ eventId: EVENT_ID, before: cursor })
        .success,
    ).toBe(true);
    expect(
      listChatMessagesSchema.safeParse({
        eventId: EVENT_ID,
        before: cursor,
        after: cursor,
      }).success,
    ).toBe(false);
  });

  it('marks as read up to a time in whole milliseconds', () => {
    expect(
      markChatReadSchema.safeParse({ eventId: EVENT_ID, at: 1.5 }).success,
    ).toBe(false);
  });

  it('reports a message for one of the reasons the chat offers', () => {
    expect(
      reportChatMessageSchema.safeParse({
        messageId: MESSAGE_ID,
        reason: 'harassment',
      }).success,
    ).toBe(true);
    expect(
      reportChatMessageSchema.safeParse({
        messageId: MESSAGE_ID,
        reason: 'boring',
      }).success,
    ).toBe(false);
  });
});
