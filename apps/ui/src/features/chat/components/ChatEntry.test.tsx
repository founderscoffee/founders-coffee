import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatEntry } from './ChatEntry';

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  preload: vi.fn(),
  isOpen: false,
  counts: new Map<string, number>(),
  countsAsked: vi.fn(),
}));

vi.mock('../useChatAddress', () => ({
  useChatAddress: () => ({
    isOpen: mocks.isOpen,
    open: mocks.open,
    close: vi.fn(),
  }),
}));
vi.mock('../chat-panel-loader', () => ({
  preloadChatConversation: mocks.preload,
}));
vi.mock('../hooks', () => ({
  useChatUnreadCounts: (eventIds: readonly string[], isEnabled: boolean) => {
    mocks.countsAsked(eventIds, isEnabled);
    return mocks.counts;
  },
}));

const entry = () => screen.getByRole('button', { name: /^Open chat/ });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.isOpen = false;
  mocks.counts = new Map();
});

describe('ChatEntry', () => {
  it('names the chat and who can read it', () => {
    render(<ChatEntry locale="en" eventId="evt_1" />);

    expect(screen.getByRole('region', { name: 'Chat' })).toBeTruthy();
    expect(
      screen.getByText(
        'Only the host and the people going can read this chat.',
      ),
    ).toBeTruthy();
    expect(entry().getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('opens the panel from its button', () => {
    render(<ChatEntry locale="en" eventId="evt_1" />);

    fireEvent.click(entry());

    expect(mocks.open).toHaveBeenCalledTimes(1);
  });

  it('shows how many messages are unread, and says it to a screen reader', () => {
    mocks.counts = new Map([['evt_1', 3]]);
    render(<ChatEntry locale="en" eventId="evt_1" />);

    expect(entry().querySelector('.badge')?.textContent).toBe('3');
    expect(
      screen.getByRole('button', { name: 'Open chat 3 unread messages' }),
    ).toBeTruthy();
    expect(mocks.countsAsked).toHaveBeenCalledWith(['evt_1'], true);
  });

  it('caps the badge at 99+, and shows none when all is read', () => {
    mocks.counts = new Map([['evt_1', 140]]);
    const { rerender } = render(<ChatEntry locale="en" eventId="evt_1" />);

    expect(screen.getByText('99+')).toBeTruthy();
    expect(screen.getByText('140 unread messages')).toBeTruthy();

    mocks.counts = new Map([['evt_1', 0]]);
    rerender(<ChatEntry locale="ar" eventId="evt_1" />);

    expect(screen.queryByText('99+')).toBeNull();
    expect(screen.getByRole('button', { name: 'فتح المحادثة' })).toBeTruthy();
  });

  it('asks nothing while the panel is open over it', () => {
    mocks.isOpen = true;
    render(<ChatEntry locale="en" eventId="evt_1" />);

    expect(mocks.countsAsked).toHaveBeenCalledWith(['evt_1'], false);
  });

  it('starts loading the panel as soon as the reader heads for the button', () => {
    render(<ChatEntry locale="en" eventId="evt_1" />);

    fireEvent.focus(entry());
    fireEvent.pointerEnter(entry());
    fireEvent.touchStart(entry());

    expect(mocks.preload).toHaveBeenCalledTimes(3);
    expect(mocks.open).not.toHaveBeenCalled();
  });
});
