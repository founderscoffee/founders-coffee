import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { appErrorCode } from '@founders-coffee/core';

import { chatQueryKey, withMessages, type ChatPages } from './chat-cache';
import { sendableBody, type PendingMessage } from './chat-items';
import { useSendChatMessage } from './hooks';

export type ChatSendRefusal = 'stale' | 'revoked' | 'signed_out';

const REFUSALS: Readonly<Record<string, ChatSendRefusal>> = {
  chat_read_only: 'stale',
  chat_not_found: 'stale',
  chat_not_member: 'revoked',
  forbidden: 'revoked',
  unauthenticated: 'signed_out',
};

/**
 * What the reader has sent that the chat has not stored yet, and the way to send more.
 *
 * A message joins the list as it is sent and leaves it when the chat answers with the stored
 * message, which goes into the cache in its place. One is sent at a time, so a reader's messages
 * are stored in the order they were written, and `isSending` says when the composer has to wait.
 *
 * A message that fails stays in the list, marked, for the reader to retry. A retry sends the same
 * `clientId`, so a message that was stored although its answer never arrived is kept once. When the
 * chat refuses rather than fails, `onRefused` is told why: the chat is no longer what the panel
 * believes (`stale`), the reader is no longer in it, or their session has ended.
 */
export const useChatOutbox = (input: {
  readonly eventId: string;
  readonly viewerId: string;
  readonly onRefused: (refusal: ChatSendRefusal) => void;
}) => {
  const { eventId, viewerId } = input;
  const queryClient = useQueryClient();
  const { mutateAsync } = useSendChatMessage();
  const [outbox, setOutbox] = useState<readonly PendingMessage[]>([]);
  const inFlightRef = useRef(false);
  const onRefusedRef = useRef(input.onRefused);

  useEffect(() => {
    onRefusedRef.current = input.onRefused;
  });

  const deliver = useCallback(
    (entry: PendingMessage) => {
      inFlightRef.current = true;
      const settle = (
        change: (list: readonly PendingMessage[]) => readonly PendingMessage[],
      ) => {
        inFlightRef.current = false;
        setOutbox(change);
      };
      mutateAsync({ eventId, body: entry.body, clientId: entry.clientId }).then(
        (message) => {
          queryClient.setQueryData<ChatPages>(
            chatQueryKey(eventId, viewerId),
            (pages) => withMessages(pages, [message]),
          );
          settle((list) =>
            list.filter((pending) => pending.clientId !== entry.clientId),
          );
        },
        (error: unknown) => {
          settle((list) =>
            list.map((pending) =>
              pending.clientId === entry.clientId
                ? { ...pending, status: 'failed' }
                : pending,
            ),
          );
          const refusal = REFUSALS[appErrorCode(error)];
          if (refusal) onRefusedRef.current(refusal);
        },
      );
    },
    [eventId, viewerId, mutateAsync, queryClient],
  );

  const send = useCallback(
    (draft: string): boolean => {
      const body = sendableBody(draft);
      if (body === null || inFlightRef.current) return false;
      const entry: PendingMessage = {
        clientId: crypto.randomUUID(),
        body,
        createdAt: new Date(),
        status: 'sending',
      };
      setOutbox((list) => [...list, entry]);
      deliver(entry);
      return true;
    },
    [deliver],
  );

  const retry = useCallback(
    (clientId: string) => {
      const entry = outbox.find(
        (pending) =>
          pending.clientId === clientId && pending.status === 'failed',
      );
      if (!entry || inFlightRef.current) return;
      const again: PendingMessage = { ...entry, status: 'sending' };
      setOutbox((list) =>
        list.map((pending) =>
          pending.clientId === clientId ? again : pending,
        ),
      );
      deliver(again);
    },
    [deliver, outbox],
  );

  return {
    outbox,
    isSending: outbox.some((pending) => pending.status === 'sending'),
    send,
    retry,
  };
};
