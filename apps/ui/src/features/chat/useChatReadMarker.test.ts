import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CHAT_READ_DELAY_MS,
  CHAT_READ_INTERVAL_MS,
  useChatReadMarker,
} from './useChatReadMarker';

const mocks = vi.hoisted(() => ({ mark: vi.fn() }));

vi.mock('./hooks', () => ({
  useMarkChatRead: () => ({ mutate: mocks.mark }),
}));

const NEWEST = Date.UTC(2026, 8, 30, 18, 0);

type Reading = {
  readonly readUpTo: Date | null;
  readonly newestAt: number | null;
  readonly isAtEnd: boolean;
};

const renderMarker = (reading: Reading) =>
  renderHook(
    (props: Reading) =>
      useChatReadMarker({ eventId: 'evt_1', viewerId: 'usr_me', ...props }),
    { initialProps: reading },
  );

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

const setVisibility = (state: DocumentVisibilityState) =>
  act(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: state,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  setVisibility('visible');
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('the reader’s read marker', () => {
  it('moves to the newest message a moment after the reader reaches it', () => {
    renderMarker({ readUpTo: null, newestAt: NEWEST, isAtEnd: true });

    advance(CHAT_READ_DELAY_MS - 1);
    expect(mocks.mark).not.toHaveBeenCalled();
    advance(1);

    expect(mocks.mark).toHaveBeenCalledWith(NEWEST);
  });

  it('waits while the reader is scrolled up, or the page is out of sight', () => {
    const { rerender } = renderMarker({
      readUpTo: null,
      newestAt: NEWEST,
      isAtEnd: false,
    });
    advance(CHAT_READ_INTERVAL_MS);
    expect(mocks.mark).not.toHaveBeenCalled();

    setVisibility('hidden');
    rerender({ readUpTo: null, newestAt: NEWEST, isAtEnd: true });
    advance(CHAT_READ_INTERVAL_MS);
    expect(mocks.mark).not.toHaveBeenCalled();

    setVisibility('visible');
    advance(CHAT_READ_DELAY_MS);
    expect(mocks.mark).toHaveBeenCalledWith(NEWEST);
  });

  it('moves no more often than every six seconds in a busy chat', () => {
    const { rerender } = renderMarker({
      readUpTo: null,
      newestAt: NEWEST,
      isAtEnd: true,
    });
    advance(CHAT_READ_DELAY_MS);
    expect(mocks.mark).toHaveBeenCalledTimes(1);

    rerender({ readUpTo: null, newestAt: NEWEST + 1_000, isAtEnd: true });
    advance(CHAT_READ_INTERVAL_MS - 1);
    expect(mocks.mark).toHaveBeenCalledTimes(1);
    advance(1);

    expect(mocks.mark).toHaveBeenCalledTimes(2);
    expect(mocks.mark).toHaveBeenLastCalledWith(NEWEST + 1_000);
  });

  it('makes a waiting move when the panel closes, and none for what was already read', () => {
    const first = renderMarker({
      readUpTo: null,
      newestAt: NEWEST,
      isAtEnd: true,
    });
    first.unmount();
    expect(mocks.mark).toHaveBeenCalledWith(NEWEST);

    mocks.mark.mockClear();
    const second = renderMarker({
      readUpTo: new Date(NEWEST),
      newestAt: NEWEST,
      isAtEnd: true,
    });
    advance(CHAT_READ_INTERVAL_MS);
    second.unmount();
    expect(mocks.mark).not.toHaveBeenCalled();
  });
});
