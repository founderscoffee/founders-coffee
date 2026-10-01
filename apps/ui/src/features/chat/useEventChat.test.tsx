import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@founders-coffee/core';
import { CHAT_ROOM_CLOSES } from '@founders-coffee/core/rooms';

import type { ChatMessageView } from './api';
import { chatQueryKey, withLastRead, type ChatPages } from './chat-cache';
import {
  chatMessage,
  chatPage,
  FakeSocket,
  latestSocket,
  openedSockets,
  YACINE,
} from './chat.fixtures';
import {
  useEventChat,
  type EventChatView,
  type ReadyChat,
} from './useEventChat';

const mocks = vi.hoisted(() => ({
  page: vi.fn(),
  before: vi.fn(),
  after: vi.fn(),
  send: vi.fn(),
  markRead: vi.fn(),
}));

vi.mock('./api', () => ({ chatApi: mocks }));

const AT = new Date('2026-09-30T18:00:00Z');
const minutesAfter = (minutes: number) =>
  new Date(AT.getTime() + minutes * 60_000);
const KEY = chatQueryKey('evt_1', 'usr_me');

let cache: QueryClient;

const Wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={cache}>{children}</QueryClientProvider>
);

const renderChat = () =>
  renderHook(
    () =>
      useEventChat({
        eventId: 'evt_1',
        viewerId: 'usr_me',
        timeZone: 'Africa/Algiers',
      }),
    { wrapper: Wrapper },
  );

const ready = (view: EventChatView): ReadyChat => {
  if (view.status !== 'ready') throw new Error(`The chat is ${view.status}`);
  return view;
};

const rowsOf = (view: EventChatView): string[] =>
  ready(view)
    .items.filter((item) => item.kind !== 'day')
    .map((item) => (item.kind === 'pending' ? 'pending' : item.key));

const opened = async (view: () => EventChatView): Promise<ReadyChat> => {
  await waitFor(() => expect(view().status).toBe('ready'));
  return ready(view());
};

beforeEach(() => {
  cache = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  openedSockets.length = 0;
  vi.stubGlobal('WebSocket', FakeSocket);
  mocks.after.mockResolvedValue({ messages: [], hasMore: false });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe('a meetup’s chat as its panel shows it', () => {
  it('opens with the first page, then joins the room and reads what was said since', async () => {
    mocks.page.mockResolvedValue(
      chatPage({ messages: [chatMessage('msg_1', AT)] }),
    );
    mocks.after.mockResolvedValueOnce({
      messages: [chatMessage('msg_2', minutesAfter(1))],
      hasMore: false,
    });
    const { result } = renderChat();
    expect(result.current.status).toBe('loading');

    await opened(() => result.current);
    expect(rowsOf(result.current)).toEqual(['msg_1']);
    expect(latestSocket().url).toContain('/api/chat/evt_1');

    latestSocket().open();

    await waitFor(() =>
      expect(rowsOf(result.current)).toEqual(['msg_1', 'msg_2']),
    );
    expect(mocks.after).toHaveBeenCalledWith('evt_1', {
      at: AT.getTime(),
      id: 'msg_1',
    });
    expect(ready(result.current).connection).toBe('live');
  });

  it('shows what the room pushes, and a message that arrives both ways once', async () => {
    mocks.page.mockResolvedValue(chatPage());
    const { result } = renderChat();
    await opened(() => result.current);
    latestSocket().open();

    const pushed = chatMessage('msg_1', AT);
    latestSocket().push({ type: 'message', message: pushed });
    latestSocket().push({ type: 'message', message: pushed });
    latestSocket().push({
      type: 'message',
      message: chatMessage('msg_2', minutesAfter(1)),
    });

    await waitFor(() =>
      expect(rowsOf(result.current)).toEqual(['msg_1', 'msg_2']),
    );
    latestSocket().push({ type: 'removed', id: 'msg_1', removal: 'host' });
    await waitFor(() => {
      const [row] = ready(result.current).items.filter(
        (item) => item.kind === 'message',
      );
      expect(row?.kind === 'message' && row.message.removal).toBe('host');
    });
  });

  it('joins no room for a chat that is read-only, and offers nothing to send', async () => {
    mocks.page.mockResolvedValue(
      chatPage({ state: 'read_only', messages: [chatMessage('msg_1', AT)] }),
    );
    const { result } = renderChat();

    const chat = await opened(() => result.current);

    expect(chat.isOpen).toBe(false);
    expect(openedSockets).toHaveLength(0);
  });

  it('keeps the unread divider where it was when the panel opened', async () => {
    mocks.page.mockResolvedValue(
      chatPage({
        lastReadAt: AT,
        messages: [
          chatMessage('msg_1', AT),
          chatMessage('msg_2', minutesAfter(2), { author: YACINE }),
        ],
      }),
    );
    const { result } = renderChat();
    await opened(() => result.current);
    expect(rowsOf(result.current)).toEqual(['msg_1', 'unread', 'msg_2']);

    act(() => {
      cache.setQueryData<ChatPages>(KEY, (pages) =>
        withLastRead(pages, minutesAfter(5)),
      );
    });

    await waitFor(() =>
      expect(ready(result.current).meta.lastReadAt).toEqual(minutesAfter(5)),
    );
    expect(rowsOf(result.current)).toEqual(['msg_1', 'unread', 'msg_2']);
  });

  it.each([
    ['chat_not_found', 'unavailable'],
    ['chat_not_member', 'revoked'],
    ['unauthenticated', 'signed_out'],
  ] as const)(
    'turns the reader away on %s, as %s, and asks nothing again',
    async (code, loss) => {
      mocks.page.mockRejectedValue(new AppError(code, code));
      const { result } = renderChat();

      await waitFor(() => expect(result.current.status).toBe(loss));

      expect(mocks.page).toHaveBeenCalledTimes(1);
      expect(cache.getQueryData(KEY)).toBeUndefined();
    },
  );

  it('offers another try after a read that failed for any other reason', async () => {
    mocks.page.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderChat();
    await waitFor(() => expect(result.current.status).toBe('error'));

    mocks.page.mockResolvedValue(chatPage());
    act(() => {
      if (result.current.status === 'error') result.current.retry();
    });

    await opened(() => result.current);
  });

  it('loses the chat, and what the panel held, when the room turns the reader away', async () => {
    mocks.page.mockResolvedValue(chatPage());
    const { result } = renderChat();
    await opened(() => result.current);
    latestSocket().open();

    latestSocket().drop(CHAT_ROOM_CLOSES.revoked.code);

    await waitFor(() => expect(result.current.status).toBe('revoked'));
    expect(cache.getQueryData(KEY)).toBeUndefined();
  });

  it('reads the page again when a send finds the chat read-only, and closes the room', async () => {
    mocks.page.mockResolvedValueOnce(chatPage());
    mocks.page.mockResolvedValueOnce(chatPage({ state: 'read_only' }));
    mocks.send.mockRejectedValue(new AppError('chat_read_only', 'read only'));
    const { result } = renderChat();
    await opened(() => result.current);
    latestSocket().open();

    act(() => {
      ready(result.current).send('Salam');
    });

    await waitFor(() => expect(ready(result.current).isOpen).toBe(false));
    expect(mocks.page).toHaveBeenCalledTimes(2);
    expect(latestSocket().closedWith).toEqual({ code: 1000, reason: 'left' });
  });

  it('shows a message sent from here once when the room pushes it before the send is answered', async () => {
    let answer: (message: ChatMessageView) => void = () => undefined;
    mocks.page.mockResolvedValue(chatPage());
    mocks.send.mockReturnValue(
      new Promise<ChatMessageView>((resolve) => {
        answer = resolve;
      }),
    );
    const { result } = renderChat();
    await opened(() => result.current);
    latestSocket().open();

    act(() => {
      ready(result.current).send('Salam');
    });
    expect(rowsOf(result.current)).toEqual(['pending']);
    await waitFor(() => expect(mocks.send).toHaveBeenCalled());
    const clientId = String(
      (mocks.send.mock.lastCall?.[0] as { clientId: string }).clientId,
    );
    const stored = chatMessage('msg_1', AT, {
      isOwn: true,
      body: 'Salam',
      clientId,
    });

    latestSocket().push({ type: 'message', message: stored });
    await waitFor(() => expect(rowsOf(result.current)).toEqual(['msg_1']));

    await act(async () => answer(stored));
    expect(rowsOf(result.current)).toEqual(['msg_1']);
    expect(ready(result.current).isSending).toBe(false);
  });
});
