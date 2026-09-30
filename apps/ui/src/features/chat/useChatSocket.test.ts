import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CHAT_ROOM_CLOSES,
  HEARTBEAT_FRAME,
  HEARTBEAT_INTERVAL_MS,
} from '@founders-coffee/core/rooms';

import { FakeSocket, latestSocket, openedSockets } from './chat.fixtures';
import {
  CHAT_POLL_INTERVAL_MS,
  CHAT_RECONNECT_DELAY_MS,
  useChatSocket,
  type ChatSocketHandlers,
} from './useChatSocket';

const handlers = (): ChatSocketHandlers => ({
  onMessage: vi.fn(),
  onRemoved: vi.fn(),
  onCatchUp: vi.fn(),
  onClosed: vi.fn(),
});

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

let isOnline = true;

beforeEach(() => {
  openedSockets.length = 0;
  isOnline = true;
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => isOnline);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the socket to a meetup’s chat room', () => {
  it('opens only while enabled, and asks for the gap every time it opens', () => {
    const on = handlers();
    const { result, rerender } = renderHook(
      ({ isEnabled }) => useChatSocket('evt_1', isEnabled, on),
      { initialProps: { isEnabled: false } },
    );
    expect(openedSockets).toHaveLength(0);

    rerender({ isEnabled: true });
    expect(latestSocket().url).toBe(
      `ws://${window.location.host}/api/chat/evt_1`,
    );
    expect(result.current.connection).toBe('connecting');

    latestSocket().open();
    expect(result.current.connection).toBe('live');
    expect(on.onCatchUp).toHaveBeenCalledTimes(1);

    rerender({ isEnabled: false });
    expect(latestSocket().closedWith).toEqual({ code: 1000, reason: 'left' });
  });

  it('keeps the socket alive with the heartbeat the runtime answers', () => {
    renderHook(() => useChatSocket('evt_1', true, handlers()));
    latestSocket().open();

    advance(HEARTBEAT_INTERVAL_MS);

    expect(latestSocket().sent).toEqual([HEARTBEAT_FRAME]);
  });

  it('hands on the messages and removals the room pushes, as dates and tombstones', () => {
    const on = handlers();
    renderHook(() => useChatSocket('evt_1', true, on));
    latestSocket().open();

    latestSocket().push({
      type: 'message',
      message: {
        id: 'msg_1',
        kind: 'text',
        body: 'Salam',
        systemKey: null,
        systemParams: null,
        createdAt: '2026-09-30T18:00:00.000Z',
        removal: null,
        author: null,
        isOwn: false,
        clientId: null,
      },
    });
    latestSocket().push({ type: 'removed', id: 'msg_1', removal: 'author' });
    latestSocket().push({ type: 'heartbeat_ack' });

    expect(on.onMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'msg_1',
        createdAt: new Date('2026-09-30T18:00:00.000Z'),
      }),
    );
    expect(on.onRemoved).toHaveBeenCalledWith({
      id: 'msg_1',
      removal: 'author',
    });
  });

  it('opens a dropped socket again after one second, then two, then four', () => {
    const { result } = renderHook(() =>
      useChatSocket('evt_1', true, handlers()),
    );
    latestSocket().open();

    latestSocket().drop(1006);
    expect(result.current.connection).toBe('reconnecting');
    advance(CHAT_RECONNECT_DELAY_MS.first - 1);
    expect(openedSockets).toHaveLength(1);
    advance(1);
    expect(openedSockets).toHaveLength(2);

    latestSocket().drop(4002, 'heartbeat_timeout');
    advance(2 * CHAT_RECONNECT_DELAY_MS.first);
    expect(openedSockets).toHaveLength(3);

    latestSocket().drop(1013, 'try_again_later');
    advance(2 * CHAT_RECONNECT_DELAY_MS.first);
    expect(openedSockets).toHaveLength(3);
    advance(2 * CHAT_RECONNECT_DELAY_MS.first);
    expect(openedSockets).toHaveLength(4);
  });

  it.each([
    [CHAT_ROOM_CLOSES.noSession.code, 'signed_out'],
    [CHAT_ROOM_CLOSES.revoked.code, 'revoked'],
    [CHAT_ROOM_CLOSES.closed.code, 'closed'],
    [CHAT_ROOM_CLOSES.superseded.code, 'paused'],
  ] as const)(
    'stops for good on close %i, which it reports as %s',
    (code, ending) => {
      const on = handlers();
      const { result } = renderHook(() => useChatSocket('evt_1', true, on));
      latestSocket().open();

      latestSocket().drop(code);
      advance(CHAT_RECONNECT_DELAY_MS.longest);

      expect(result.current.connection).toBe(ending);
      expect(openedSockets).toHaveLength(1);
      expect(on.onClosed).toHaveBeenCalledTimes(ending === 'closed' ? 1 : 0);
    },
  );

  it('takes the room’s word before the close code, which a proxy may not carry intact', () => {
    const { result } = renderHook(() =>
      useChatSocket('evt_1', true, handlers()),
    );
    latestSocket().open();

    latestSocket().push({ type: 'revoked' });
    latestSocket().drop(1006);

    expect(result.current.connection).toBe('revoked');
  });

  it.each([
    ['closed', CHAT_ROOM_CLOSES.closed.code],
    ['revoked', CHAT_ROOM_CLOSES.revoked.code],
  ] as const)(
    'ends on the room’s %s frame at once, without waiting for a close a proxy may hold back',
    (type, code) => {
      const on = handlers();
      const { result } = renderHook(() => useChatSocket('evt_1', true, on));
      const socket = latestSocket();
      socket.open();

      socket.push({ type });

      expect(result.current.connection).toBe(type);
      expect(on.onClosed).toHaveBeenCalledTimes(type === 'closed' ? 1 : 0);
      expect(socket.closedWith).toEqual({ code: 1000, reason: 'left' });

      socket.drop(code);
      advance(CHAT_RECONNECT_DELAY_MS.longest);

      expect(on.onClosed).toHaveBeenCalledTimes(type === 'closed' ? 1 : 0);
      expect(openedSockets).toHaveLength(1);
    },
  );

  it('takes a paused socket back when the reader asks', () => {
    const { result } = renderHook(() =>
      useChatSocket('evt_1', true, handlers()),
    );
    latestSocket().open();
    latestSocket().drop(CHAT_ROOM_CLOSES.superseded.code);

    act(() => result.current.resume());

    expect(openedSockets).toHaveLength(2);
    expect(result.current.connection).toBe('reconnecting');
  });

  it('reads the gap every fifteen seconds after three openedSockets in a row never opened, until one does', () => {
    const on = handlers();
    const { result } = renderHook(() => useChatSocket('evt_1', true, on));

    for (let failure = 0; failure < 3; failure += 1) {
      latestSocket().drop(1006);
      advance(CHAT_RECONNECT_DELAY_MS.longest);
    }
    expect(result.current.isPolling).toBe(true);
    const asked = vi.mocked(on.onCatchUp).mock.calls.length;
    advance(CHAT_POLL_INTERVAL_MS);
    expect(on.onCatchUp).toHaveBeenCalledTimes(asked + 1);

    latestSocket().open();
    expect(result.current.isPolling).toBe(false);
  });

  it('tries nothing while the browser is offline, and at once when it is back', () => {
    isOnline = false;
    const { result } = renderHook(() =>
      useChatSocket('evt_1', true, handlers()),
    );
    expect(result.current.connection).toBe('offline');
    expect(openedSockets).toHaveLength(0);

    isOnline = true;
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(openedSockets).toHaveLength(1);
  });
});
