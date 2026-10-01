import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ChatPages } from '../chat-cache';

const mocks = vi.hoisted(() => ({
  pages: undefined as ChatPages | undefined,
  isPending: false,
  mutate: vi.fn(),
}));

vi.mock('../hooks', () => ({
  useChatPages: () => ({ data: mocks.pages }),
  useSetChatMuted: () => ({ isPending: mocks.isPending, mutate: mocks.mutate }),
}));

const { ChatMuteToggle } = await import('./ChatMuteToggle');

const pagesWith = (muted: boolean): ChatPages => ({
  pages: [
    {
      messages: [],
      hasOlder: false,
      meta: {
        isHost: false,
        state: 'open',
        readOnlyAt: new Date('2026-10-09T18:00:00Z'),
        lastReadAt: null,
        muted,
      },
    },
  ],
  pageParams: [null],
});

const show = () =>
  render(<ChatMuteToggle locale="en" eventId="evt_1" viewerId="usr_me" />);

const toggle = () => screen.getByRole('button', { name: 'Mute notifications' });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.pages = undefined;
  mocks.isPending = false;
});

describe('ChatMuteToggle', () => {
  it('offers nothing until the chat has opened', () => {
    show();

    expect(screen.queryByRole('button')).toBeNull();
  });

  it.each([false, true])(
    'says whether the chat is muted (%s) and asks for the other state',
    (muted) => {
      mocks.pages = pagesWith(muted);
      show();

      expect(toggle().getAttribute('aria-pressed')).toBe(String(muted));
      fireEvent.click(toggle());

      expect(mocks.mutate).toHaveBeenCalledWith(!muted, expect.anything());
    },
  );

  it('waits for one change to be kept before offering another', () => {
    mocks.pages = pagesWith(false);
    mocks.isPending = true;
    show();

    expect((toggle() as HTMLButtonElement).disabled).toBe(true);
  });

  it('says so when the change could not be kept', () => {
    mocks.pages = pagesWith(false);
    show();

    fireEvent.click(toggle());
    const options = mocks.mutate.mock.calls[0]?.[1] as { onError: () => void };
    act(() => options.onError());

    expect(screen.getByRole('alert').textContent).toContain(
      'Notifications could not be changed. Try again.',
    );
  });
});
