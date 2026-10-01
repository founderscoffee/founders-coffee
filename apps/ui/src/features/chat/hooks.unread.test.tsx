import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { chatQueryKey, metaOf, type ChatPages } from './chat-cache';
import { chatPage } from './chat.fixtures';

const mocks = vi.hoisted(() => ({
  session: { data: { user: { id: 'usr_me' } } } as {
    data: { user: { id: string } } | null;
  },
  unreadCounts: vi.fn(),
  setMuted: vi.fn(),
  markRead: vi.fn(),
}));

vi.mock('../../lib/hydration-safe-session', () => ({
  useHydrationSafeSession: () => mocks.session,
}));
vi.mock('./api', () => ({
  chatApi: {
    unreadCounts: mocks.unreadCounts,
    setMuted: mocks.setMuted,
    markRead: mocks.markRead,
  },
}));

const { useChatUnreadCounts, useMarkChatRead, useSetChatMuted } =
  await import('./hooks');

let cache: QueryClient;

const Wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={cache}>{children}</QueryClientProvider>
);

beforeEach(() => {
  cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.session = { data: { user: { id: 'usr_me' } } };
  mocks.unreadCounts.mockResolvedValue([{ eventId: 'evt_a', unread: 2 }]);
  mocks.setMuted.mockImplementation(async (_eventId, muted: boolean) => ({
    muted,
  }));
  mocks.markRead.mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('the unread counts of a member’s chats', () => {
  it('asks once about each meetup, and answers by meetup', async () => {
    const { result } = renderHook(
      () => useChatUnreadCounts(['evt_b', 'evt_a', 'evt_b']),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.get('evt_a')).toBe(2));
    expect(mocks.unreadCounts).toHaveBeenCalledTimes(1);
    expect(mocks.unreadCounts).toHaveBeenCalledWith(['evt_a', 'evt_b']);
  });

  it('asks about a hundred meetups at most', async () => {
    const ids = Array.from({ length: 120 }, (_, n) => `evt_${1000 + n}`);
    renderHook(() => useChatUnreadCounts(ids), { wrapper: Wrapper });

    await waitFor(() => expect(mocks.unreadCounts).toHaveBeenCalled());
    expect(mocks.unreadCounts.mock.calls[0]?.[0]).toHaveLength(100);
  });

  it.each([
    ['for nobody signed in', () => (mocks.session = { data: null }), ['evt_a']],
    ['about no meetup', () => undefined, []],
  ])('asks nothing %s', async (_case, arrange, ids) => {
    arrange();
    const { result } = renderHook(() => useChatUnreadCounts(ids), {
      wrapper: Wrapper,
    });

    await act(async () => undefined);
    expect(mocks.unreadCounts).not.toHaveBeenCalled();
    expect(result.current.size).toBe(0);
  });

  it('waits while it is not wanted, and asks again once the reader has read further', async () => {
    const { result, rerender } = renderHook(
      ({ isEnabled }) => ({
        counts: useChatUnreadCounts(['evt_a'], isEnabled),
        read: useMarkChatRead('evt_a', 'usr_me'),
      }),
      { wrapper: Wrapper, initialProps: { isEnabled: false } },
    );
    await act(async () => undefined);
    expect(mocks.unreadCounts).not.toHaveBeenCalled();

    rerender({ isEnabled: true });
    await waitFor(() => expect(mocks.unreadCounts).toHaveBeenCalledTimes(1));
    await act(async () => {
      await result.current.read.mutateAsync(Date.UTC(2026, 8, 30, 18));
    });

    await waitFor(() => expect(mocks.unreadCounts).toHaveBeenCalledTimes(2));
  });
});

describe('muting a chat', () => {
  it('keeps the choice the server kept with the panel’s page', async () => {
    const key = chatQueryKey('evt_a', 'usr_me');
    const { messages, hasOlder, ...meta } = chatPage({ messages: [] });
    cache.setQueryData<ChatPages>(key, {
      pages: [{ messages, hasOlder, meta }],
      pageParams: [null],
    });
    const { result } = renderHook(() => useSetChatMuted('evt_a', 'usr_me'), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync(true);
    });

    expect(mocks.setMuted).toHaveBeenCalledWith('evt_a', true);
    expect(metaOf(cache.getQueryData<ChatPages>(key))?.muted).toBe(true);
  });
});
