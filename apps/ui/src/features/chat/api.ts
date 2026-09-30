import type { ChatReportReason } from '@founders-coffee/core';
import type { ChatUnreadCount } from '@founders-coffee/db';
import type { chat } from '@founders-coffee/domain';
import {
  getChatPage,
  getChatUnreadCounts,
  listChatMessages,
  markChatRead,
  removeChatMessage,
  reportChatMessage,
  sendChatMessage,
  setChatMuted,
  type ChatMessagesPage,
  type ChatMessageView,
  type ChatPage,
} from '@founders-coffee/server-fns';

export type ChatCursor = chat.ChatCursor;
export type ChatUnreadCounts = readonly ChatUnreadCount[];
export type ChatReportStatus = 'reported' | 'already_reported';
export type ChatRemoval = Pick<ChatMessageView, 'id'> & {
  readonly removal: NonNullable<ChatMessageView['removal']>;
};

export const chatApi = {
  page: (eventId: string): Promise<ChatPage> =>
    getChatPage({ data: { eventId } }),
  before: (eventId: string, before: ChatCursor): Promise<ChatMessagesPage> =>
    listChatMessages({ data: { eventId, before } }),
  after: (
    eventId: string,
    after: ChatCursor | undefined,
  ): Promise<ChatMessagesPage> =>
    listChatMessages({ data: after ? { eventId, after } : { eventId } }),
  send: (input: {
    eventId: string;
    body: string;
    clientId: string;
  }): Promise<ChatMessageView> => sendChatMessage({ data: input }),
  markRead: (eventId: string, at: number): Promise<null> =>
    markChatRead({ data: { eventId, at } }),
  setMuted: (
    eventId: string,
    muted: boolean,
  ): Promise<{ readonly muted: boolean }> =>
    setChatMuted({ data: { eventId, muted } }),
  unreadCounts: (eventIds: readonly string[]): Promise<ChatUnreadCounts> =>
    getChatUnreadCounts({ data: { eventIds: [...eventIds] } }),
  remove: (messageId: string): Promise<ChatRemoval> =>
    removeChatMessage({ data: { messageId } }),
  report: (
    messageId: string,
    reason: ChatReportReason,
  ): Promise<{ readonly status: ChatReportStatus }> =>
    reportChatMessage({ data: { messageId, reason } }),
};

export type { ChatMessagesPage, ChatMessageView, ChatPage };
