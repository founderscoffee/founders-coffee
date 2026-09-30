import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { chatQueryKey, messagesOf, type ChatPages } from './chat-cache';
import { chatMessage, chatMeta } from './chat.fixtures';

const mocks = vi.hoisted(() => ({ remove: vi.fn(), report: vi.fn() }));

vi.mock('../../lib/hydration-safe-session', () => ({
  useHydrationSafeSession: () => ({ data: null }),
}));
vi.mock('./api', () => ({
  chatApi: { remove: mocks.remove, report: mocks.report },
}));

const { useRemoveChatMessage, useReportChatMessage } = await import('./hooks');

const AT = new Date('2026-09-30T18:05:00Z');
const KEY = chatQueryKey('evt_1', 'usr_me');

let cache: QueryClient;

const Wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={cache}>{children}</QueryClientProvider>
);

const held = (): ChatPages => ({
  pages: [
    {
      messages: [
        chatMessage('msg_1', AT, { body: 'Buy my course' }),
        chatMessage('msg_2', AT, { body: 'Salam' }),
      ],
      hasOlder: false,
      meta: chatMeta({ isHost: true }),
    },
  ],
  pageParams: [null],
});

beforeEach(() => {
  cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  cache.setQueryData(KEY, held());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('removing a message from the chat', () => {
  it('puts the tombstone the server answered with in the panel’s cache', async () => {
    mocks.remove.mockResolvedValue({ id: 'msg_1', removal: 'host' });
    const { result } = renderHook(
      () => useRemoveChatMessage('evt_1', 'usr_me'),
      { wrapper: Wrapper },
    );

    await act(() => result.current.mutateAsync('msg_1'));

    expect(mocks.remove.mock.calls[0]?.[0]).toBe('msg_1');
    const [removed, kept] = messagesOf(cache.getQueryData<ChatPages>(KEY));
    expect(removed).toMatchObject({ id: 'msg_1', body: '', removal: 'host' });
    expect(kept).toMatchObject({ id: 'msg_2', body: 'Salam', removal: null });
  });

  it('leaves the panel as it was when the server refuses', async () => {
    mocks.remove.mockRejectedValue({ code: 'chat_message_not_found' });
    const { result } = renderHook(
      () => useRemoveChatMessage('evt_1', 'usr_me'),
      { wrapper: Wrapper },
    );

    await act(() => result.current.mutateAsync('msg_1').catch(() => null));

    expect(cache.getQueryData<ChatPages>(KEY)).toEqual(held());
  });
});

describe('reporting a message', () => {
  it('sends the message and the reason, and answers with what the server kept', async () => {
    mocks.report.mockResolvedValue({ status: 'already_reported' });
    const { result } = renderHook(() => useReportChatMessage(), {
      wrapper: Wrapper,
    });

    const answer = await act(() =>
      result.current.mutateAsync({ messageId: 'msg_1', reason: 'spam' }),
    );

    expect(mocks.report).toHaveBeenCalledWith('msg_1', 'spam');
    expect(answer).toEqual({ status: 'already_reported' });
    expect(cache.getQueryData<ChatPages>(KEY)).toEqual(held());
  });
});
