import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatOpenButton } from './ChatOpenButton';

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

const entry = () => screen.getByRole('button', { name: /^Chat/ });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.isOpen = false;
  mocks.counts = new Map();
});

describe('ChatOpenButton', () => {
  it('opens the panel from its button', () => {
    render(<ChatOpenButton locale="en" eventId="evt_1" />);

    fireEvent.click(entry());

    expect(mocks.open).toHaveBeenCalledTimes(1);
  });

  it('shows how many messages are unread, and says it to a screen reader', () => {
    mocks.counts = new Map([['evt_1', 3]]);
    render(<ChatOpenButton locale="en" eventId="evt_1" />);

    expect(entry().querySelector('.badge')?.textContent).toBe('3');
    expect(
      screen.getByRole('button', { name: 'Chat 3 unread messages' }),
    ).toBeTruthy();
    expect(mocks.countsAsked).toHaveBeenCalledWith(['evt_1'], true);
  });

  it('caps the badge at 99+, and shows none when all is read', () => {
    mocks.counts = new Map([['evt_1', 140]]);
    const { rerender } = render(<ChatOpenButton locale="en" eventId="evt_1" />);

    expect(screen.getByText('99+')).toBeTruthy();
    expect(screen.getByText('140 unread messages')).toBeTruthy();

    mocks.counts = new Map([['evt_1', 0]]);
    rerender(<ChatOpenButton locale="ar" eventId="evt_1" />);

    expect(screen.queryByText('99+')).toBeNull();
    expect(screen.getByRole('button', { name: 'المحادثة' })).toBeTruthy();
  });

  it('asks nothing while the panel is open over it', () => {
    mocks.isOpen = true;
    render(<ChatOpenButton locale="en" eventId="evt_1" />);

    expect(mocks.countsAsked).toHaveBeenCalledWith(['evt_1'], false);
  });

  it('starts loading the panel as soon as the reader heads for the button', () => {
    render(<ChatOpenButton locale="en" eventId="evt_1" />);

    fireEvent.focus(entry());
    fireEvent.pointerEnter(entry());
    fireEvent.touchStart(entry());

    expect(mocks.preload).toHaveBeenCalledTimes(3);
    expect(mocks.open).not.toHaveBeenCalled();
  });

  it('fills its share of a row only when asked to', () => {
    const { rerender } = render(
      <ChatOpenButton locale="fr" eventId="evt_1" isFullWidth />,
    );

    expect(
      screen.getByRole('button', { name: 'Discuter' }).className.split(' '),
    ).toContain('w-full');

    rerender(<ChatOpenButton locale="fr" eventId="evt_1" />);

    expect(
      screen.getByRole('button', { name: 'Discuter' }).className.split(' '),
      'after the meetup it stands alone, only as wide as its word',
    ).toContain('w-fit');
  });

  it('pins the unread count to its corner instead of widening the button', () => {
    mocks.counts = new Map([['evt_1', 140]]);
    render(<ChatOpenButton locale="en" eventId="evt_1" />);

    const button = screen.getByRole('button', {
      name: 'Chat 140 unread messages',
    });
    expect(button.className.split(' ')).toContain('relative');
    expect(
      button.querySelector('.badge')?.className.split(' '),
      "beside the calendar in the host's 272px rail, a count in the button's line pushed it past the panel's edge",
    ).toContain('absolute');
  });
});
