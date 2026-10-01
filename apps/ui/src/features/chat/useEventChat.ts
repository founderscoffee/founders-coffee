import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { appErrorCode } from '@founders-coffee/core';

import { chatApi } from './api';
import {
  chatQueryKey,
  cursorOf,
  messagesOf,
  metaOf,
  newestOf,
  withMessages,
  withRemoval,
  type ChatMeta,
  type ChatPages,
} from './chat-cache';
import { chatListItems, type ChatListItem } from './chat-items';
import { useChatPages } from './hooks';
import { useChatOutbox, type ChatSendRefusal } from './useChatOutbox';
import { useChatSocket, type ChatConnection } from './useChatSocket';

export type ChatLoss = 'unavailable' | 'revoked' | 'signed_out';

export type ChatHistory = {
  readonly hasMore: boolean;
  readonly isLoading: boolean;
  readonly hasFailed: boolean;
  readonly load: () => void;
};

export type ReadyChat = {
  readonly status: 'ready';
  readonly meta: ChatMeta;
  readonly items: readonly ChatListItem[];
  readonly newestAt: number | null;
  readonly isOpen: boolean;
  readonly connection: ChatConnection;
  readonly resume: () => void;
  readonly history: ChatHistory;
  readonly isSending: boolean;
  readonly send: (draft: string) => boolean;
  readonly retrySend: (clientId: string) => void;
};

export type EventChatView =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly retry: () => void }
  | { readonly status: ChatLoss }
  | ReadyChat;

const LOSSES: Readonly<Record<string, ChatLoss>> = {
  chat_not_found: 'unavailable',
  chat_not_member: 'revoked',
  forbidden: 'revoked',
  unauthenticated: 'signed_out',
};

const CATCH_UP_ROUNDS = 4;

/** What the room's close tells the panel about the reader, when it is about them rather than the chat. */
const lossOf = (connection: ChatConnection): ChatLoss | null =>
  connection === 'revoked' || connection === 'signed_out' ? connection : null;

/**
 * A meetup's chat as its panel shows it, kept current while the panel is open.
 *
 * The panel reads its first page from the server, then holds a socket to the chat's room, which
 * pushes each message and removal as it happens. Every time a socket opens, the messages after the
 * newest one held are read, in pages, so nothing said while there was none is missed, and a
 * message that arrives both ways is kept once. A chat that is read-only has no room to join.
 *
 * The unread divider stays where it was when the panel opened, however far the reader then reads.
 *
 * A reader the chat turns away, by a read, a send or the room, loses what the panel held: the
 * cached pages are dropped and nothing is asked again until the panel opens anew.
 */
export const useEventChat = (input: {
  readonly eventId: string;
  readonly viewerId: string;
  readonly timeZone: string;
}): EventChatView => {
  const { eventId, viewerId, timeZone } = input;
  const queryClient = useQueryClient();
  const key = useMemo(
    () => chatQueryKey(eventId, viewerId),
    [eventId, viewerId],
  );
  const [loss, setLoss] = useState<ChatLoss | null>(null);
  const pages = useChatPages(eventId, viewerId, loss === null);
  const { refetch } = pages;
  const meta = metaOf(pages.data);
  const isOpen = meta?.state === 'open';
  const isCatchingUpRef = useRef(false);

  const catchUp = useCallback(async () => {
    if (isCatchingUpRef.current) return;
    isCatchingUpRef.current = true;
    try {
      for (let round = 0; round < CATCH_UP_ROUNDS; round += 1) {
        const newest = newestOf(queryClient.getQueryData<ChatPages>(key));
        const gap = await chatApi.after(
          eventId,
          newest ? cursorOf(newest) : undefined,
        );
        queryClient.setQueryData<ChatPages>(key, (held) =>
          withMessages(held, gap.messages),
        );
        if (!gap.hasMore || !newest) return;
      }
      await queryClient.resetQueries({ queryKey: key, exact: true });
    } catch {
      return;
    } finally {
      isCatchingUpRef.current = false;
    }
  }, [eventId, key, queryClient]);

  const socket = useChatSocket(eventId, isOpen && loss === null, {
    onMessage: (message) =>
      queryClient.setQueryData<ChatPages>(key, (held) =>
        withMessages(held, [message]),
      ),
    onRemoved: (removed) =>
      queryClient.setQueryData<ChatPages>(key, (held) =>
        withRemoval(held, removed),
      ),
    onCatchUp: () => void catchUp(),
    onClosed: () => void refetch(),
  });

  const onRefused = useCallback(
    (refusal: ChatSendRefusal) => {
      if (refusal === 'stale') void refetch();
      else setLoss(refusal);
    },
    [refetch],
  );
  const outbox = useChatOutbox({ eventId, viewerId, onRefused });

  const pageLoss =
    pages.isError && !pages.data
      ? (LOSSES[appErrorCode(pages.error)] ?? null)
      : null;
  const lost = loss ?? lossOf(socket.connection) ?? pageLoss;

  useEffect(() => {
    if (!lost) return;
    setLoss(lost);
    queryClient.removeQueries({ queryKey: key, exact: true });
  }, [lost, key, queryClient]);

  const [divider, setDivider] = useState<{ readonly at: Date | null } | null>(
    null,
  );
  if (divider === null && meta) setDivider({ at: meta.lastReadAt });

  const messages = useMemo(() => messagesOf(pages.data), [pages.data]);
  const items = useMemo(() => {
    const stored = new Set(messages.map((message) => message.clientId));
    return chatListItems({
      messages,
      pending: outbox.outbox.filter((pending) => !stored.has(pending.clientId)),
      lastReadAt: divider?.at ?? null,
      now: new Date(),
      timeZone,
    });
  }, [messages, outbox.outbox, divider, timeZone]);

  const {
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
  } = pages;
  const history = useMemo<ChatHistory>(
    () => ({
      hasMore: hasNextPage,
      isLoading: isFetchingNextPage,
      hasFailed: isFetchNextPageError,
      load: () => void fetchNextPage({ cancelRefetch: false }),
    }),
    [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage],
  );

  if (lost) return { status: lost };
  if (!meta) {
    if (pages.isError) return { status: 'error', retry: () => void refetch() };
    return { status: 'loading' };
  }
  return {
    status: 'ready',
    meta,
    items,
    newestAt: messages.at(-1)?.createdAt.getTime() ?? null,
    isOpen,
    connection: socket.connection,
    resume: socket.resume,
    history,
    isSending: outbox.isSending,
    send: outbox.send,
    retrySend: outbox.retry,
  };
};
