import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@founders-coffee/core';

import type { ChatMessageView } from './api';
import { chatQueryKey, messagesOf, type ChatPages } from './chat-cache';
import { chatMessage, chatPage } from './chat.fixtures';
import { useChatOutbox } from './useChatOutbox';

const mocks = vi.hoisted(() => ({ send: vi.fn(), onRefused: vi.fn() }));

vi.mock('./api', () => ({ chatApi: { send: mocks.send } }));

const AT = new Date('2026-09-30T18:00:00Z');
const LATER = new Date('2026-09-30T18:05:00Z');
const KEY = chatQueryKey('evt_1', 'usr_me');

let cache: QueryClient;

const Wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={cache}>{children}</QueryClientProvider>
);

const renderOutbox = () =>
  renderHook(
    () =>
      useChatOutbox({
        eventId: 'evt_1',
        viewerId: 'usr_me',
        onRefused: mocks.onRefused,
      }),
    { wrapper: Wrapper },
  );

const later = <T,>() => {
  let settle: { resolve: (value: T) => void; reject: (cause: unknown) => void };
  const promise = new Promise<T>((resolve, reject) => {
    settle = { resolve, reject };
  });
  return {
    promise,
    resolve: (value: T) => settle.resolve(value),
    reject: (cause: unknown) => settle.reject(cause),
  };
};

const sentInput = (): unknown => mocks.send.mock.lastCall?.[0];

const stored = (clientId: string, body = 'Salam'): ChatMessageView =>
  chatMessage('msg_2', LATER, { isOwn: true, body, clientId });

beforeEach(() => {
  cache = new QueryClient();
  const { messages, hasOlder, ...meta } = chatPage({
    messages: [chatMessage('msg_1', AT)],
  });
  cache.setQueryData<ChatPages>(KEY, {
    pages: [{ messages, hasOlder, meta }],
    pageParams: [null],
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('what the reader has sent and the chat has not stored yet', () => {
  it('sends one message at a time, and swaps it for the stored one when the chat answers', async () => {
    const answer = later<ChatMessageView>();
    mocks.send.mockReturnValueOnce(answer.promise);
    const { result } = renderOutbox();

    let isAccepted = false;
    act(() => {
      isAccepted = result.current.send('  Salam ');
    });

    expect(isAccepted).toBe(true);
    expect(result.current.isSending).toBe(true);
    expect(result.current.outbox).toEqual([
      expect.objectContaining({ body: 'Salam', status: 'sending' }),
    ]);
    const clientId = result.current.outbox[0]?.clientId ?? '';
    await waitFor(() =>
      expect(sentInput()).toEqual({
        eventId: 'evt_1',
        body: 'Salam',
        clientId,
      }),
    );

    act(() => {
      isAccepted = result.current.send('And another');
    });
    expect(isAccepted).toBe(false);
    expect(result.current.outbox).toHaveLength(1);

    await act(async () => answer.resolve(stored(clientId)));

    expect(result.current.outbox).toEqual([]);
    expect(result.current.isSending).toBe(false);
    expect(
      messagesOf(cache.getQueryData<ChatPages>(KEY)).map(({ id }) => id),
    ).toEqual(['msg_1', 'msg_2']);
  });

  it('sends nothing blank', () => {
    const { result } = renderOutbox();

    let isAccepted = true;
    act(() => {
      isAccepted = result.current.send(' \n ');
    });

    expect(isAccepted).toBe(false);
    expect(result.current.outbox).toEqual([]);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('keeps a message that failed for the reader to retry, under the same client id', async () => {
    mocks.send.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { result } = renderOutbox();

    act(() => {
      result.current.send('Salam');
    });
    await waitFor(() =>
      expect(result.current.outbox[0]?.status).toBe('failed'),
    );
    expect(result.current.isSending).toBe(false);
    expect(mocks.onRefused).not.toHaveBeenCalled();

    const clientId = result.current.outbox[0]?.clientId ?? '';
    mocks.send.mockResolvedValueOnce(stored(clientId));
    act(() => result.current.retry(clientId));

    await waitFor(() => expect(result.current.outbox).toEqual([]));
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(sentInput()).toEqual({ eventId: 'evt_1', body: 'Salam', clientId });
  });

  it.each([
    ['chat_read_only', 'stale'],
    ['chat_not_found', 'stale'],
    ['chat_not_member', 'revoked'],
    ['forbidden', 'revoked'],
    ['unauthenticated', 'signed_out'],
  ] as const)('reports a refusal of %s as %s', async (code, refusal) => {
    mocks.send.mockRejectedValueOnce(new AppError(code, code));
    const { result } = renderOutbox();

    act(() => {
      result.current.send('Salam');
    });

    await waitFor(() => expect(mocks.onRefused).toHaveBeenCalledWith(refusal));
    expect(result.current.outbox[0]?.status).toBe('failed');
  });
});
