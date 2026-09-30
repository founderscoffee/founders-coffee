import type { chat } from '@founders-coffee/domain';
import {
  getChatPage,
  listChatMessages,
  markChatRead,
  sendChatMessage,
  type ChatMessagesPage,
  type ChatMessageView,
  type ChatPage,
} from '@founders-coffee/server-fns';

export type ChatCursor = chat.ChatCursor;

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
};

export type { ChatMessagesPage, ChatMessageView, ChatPage };
