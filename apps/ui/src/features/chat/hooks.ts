import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useMemo } from 'react';

import { appErrorCode } from '@founders-coffee/core';
import { chat } from '@founders-coffee/domain';

import { useHydrationSafeSession } from '../../lib/hydration-safe-session';
import { chatApi, type ChatCursor } from './api';
import {
  chatQueryKey,
  cursorOf,
  withLastRead,
  withMuted,
  type ChatChunk,
  type ChatPages,
} from './chat-cache';

export const CHAT_UNREAD_QUERY_KEY = ['chat-unread'] as const;

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
 *
 * The unread counts are marked stale with it. A count on screen is asked again at once; the
 * meetup page's own waits behind the open panel and is asked again when the panel closes.
 */
export const useMarkChatRead = (eventId: string, viewerId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (at: number) => chatApi.markRead(eventId, at),
    onSuccess: (_answer, at) => {
      queryClient.setQueryData<ChatPages>(
        chatQueryKey(eventId, viewerId),
        (pages) => withLastRead(pages, new Date(at)),
      );
      void queryClient.invalidateQueries({ queryKey: CHAT_UNREAD_QUERY_KEY });
    },
  });
};

/** Mute or unmute the chat for the reader, and keep the choice the server kept in the panel's cache. */
export const useSetChatMuted = (eventId: string, viewerId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (muted: boolean) => chatApi.setMuted(eventId, muted),
    onSuccess: (answer) =>
      queryClient.setQueryData<ChatPages>(
        chatQueryKey(eventId, viewerId),
        (pages) => withMuted(pages, answer.muted),
      ),
  });
};

/**
 * How many messages the signed-in reader has not read in each of their chats among `eventIds`,
 * by meetup, read from a private query of its own: the lists these ids come from are public.
 *
 * Nothing is asked while `isEnabled` is false or there is no one signed in or nothing to ask
 * about, and a failure leaves the counts empty, since a missing badge is the harmless answer. At
 * most the first `CHAT_UNREAD_COUNTS_MAX` ids are asked about.
 */
export const useChatUnreadCounts = (
  eventIds: readonly string[],
  isEnabled = true,
): ReadonlyMap<string, number> => {
  const auth = useHydrationSafeSession();
  const userId = auth.data?.user.id;
  const asked = [...new Set(eventIds)]
    .sort()
    .slice(0, chat.CHAT_UNREAD_COUNTS_MAX);
  const { data } = useQuery({
    queryKey: [...CHAT_UNREAD_QUERY_KEY, userId, asked.join(',')],
    queryFn: () => chatApi.unreadCounts(asked),
    enabled: isEnabled && !!userId && asked.length > 0,
    retry: false,
  });
  return useMemo(
    () => new Map((data ?? []).map((count) => [count.eventId, count.unread])),
    [data],
  );
};
