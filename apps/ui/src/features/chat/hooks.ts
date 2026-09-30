import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { appErrorCode } from '@founders-coffee/core';

import { chatApi, type ChatCursor } from './api';
import {
  chatQueryKey,
  cursorOf,
  withLastRead,
  type ChatChunk,
  type ChatPages,
} from './chat-cache';

const REFUSALS = new Set([
  'chat_not_found',
  'chat_not_member',
  'unauthenticated',
  'forbidden',
  'validation_failed',
]);

/** Whether a failed read is worth asking once more: a refusal answers the same however often. */
const isWorthRetrying = (failures: number, error: unknown): boolean =>
  failures < 2 && !REFUSALS.has(appErrorCode(error));

/**
 * A meetup's chat as the reader's panel holds it: the page it opened with, then older pages as the
 * reader scrolls back.
 *
 * The first page is `getChatPage`, which brings the chat's state and the reader's own with its
 * latest messages; each older one is `listChatMessages` before the oldest message held. Nothing
 * here refetches on its own. What was said since arrives from the room, or from the gap read after
 * a reconnect, so asking again on focus would only repeat what the cache holds. A panel the chat
 * has turned away asks nothing more, by `isEnabled`.
 */
export const useChatPages = (
  eventId: string,
  viewerId: string,
  isEnabled: boolean,
) =>
  useInfiniteQuery({
    queryKey: chatQueryKey(eventId, viewerId),
    queryFn: async ({ pageParam }): Promise<ChatChunk> => {
      if (pageParam === null) {
        const { messages, hasOlder, ...meta } = await chatApi.page(eventId);
        return { messages, hasOlder, meta };
      }
      const older = await chatApi.before(eventId, pageParam);
      return { messages: older.messages, hasOlder: older.hasMore, meta: null };
    },
    initialPageParam: null as ChatCursor | null,
    getNextPageParam: (chunk) => {
      const oldest = chunk.messages[0];
      return chunk.hasOlder && oldest ? cursorOf(oldest) : undefined;
    },
    enabled: isEnabled,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: isWorthRetrying,
  });

/** Post a message, the same `clientId` each time it is retried so the chat keeps it once. */
export const useSendChatMessage = () =>
  useMutation({ mutationFn: chatApi.send });

/**
 * Move the reader's read marker to a message's time, and keep the marker the cache holds with it,
 * so the next time the panel opens its unread divider starts where the reader stopped.
 */
export const useMarkChatRead = (eventId: string, viewerId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (at: number) => chatApi.markRead(eventId, at),
    onSuccess: (_answer, at) =>
      queryClient.setQueryData<ChatPages>(
        chatQueryKey(eventId, viewerId),
        (pages) => withLastRead(pages, new Date(at)),
      ),
  });
};
