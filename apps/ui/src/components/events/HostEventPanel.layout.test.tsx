import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EventWithAttendance } from '@founders-coffee/server-fns';

import { cancelled, ended, event, inProgress } from './HostEventPanel.fixtures';

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),
}));

vi.mock('../../features/events/hooks', () => ({
  useCancelEvent: () => ({ mutate: vi.fn(), isPending: false }),
  useRepeatEventTemplate: () => ({ data: null }),
}));

vi.mock('./CancelEventDialog', () => ({ CancelEventDialog: () => null }));
vi.mock('./RepeatHostLink', () => ({ RepeatHostLink: () => null }));
vi.mock('./HostLiveActions', () => ({ HostLiveActions: () => null }));
vi.mock('../../features/chat/useChatAddress', () => ({
  useChatAddress: () => ({ isOpen: false, open: vi.fn(), close: vi.fn() }),
}));
vi.mock('../../features/chat/hooks', () => ({
  useChatUnreadCounts: () => new Map(),
}));
vi.mock('../../features/chat/chat-panel-loader', () => ({
  preloadChatConversation: vi.fn(),
}));

const { HostEventPanel } = await import('./HostEventPanel');

const show = (item: EventWithAttendance, isChatAvailable = false) =>
  render(
    <HostEventPanel
      event={item}
      locale="en"
      marketSlug="algeria"
      live={null}
      isWindowOpen={false}
      isChatAvailable={isChatAvailable}
    />,
  );

afterEach(() => cleanup());

describe('HostEventPanel lays its actions out in two rows', () => {
  const edit = () => screen.getByRole('link', { name: 'Edit' });
  const cancel = () =>
    screen.getByRole('button', { name: 'Cancel this meetup' });
  const calendar = () =>
    screen.getByRole('group', { name: 'Add to your calendar' });
  const chat = () => screen.getByRole('button', { name: 'Chat' });

  it('puts Edit and Cancel side by side in a row of their own', () => {
    show(event);
    const row = edit().parentElement;
    expect(
      cancel().parentElement,
      'the host asked for the two ways to change the meetup on one line',
    ).toBe(row);
    expect(row?.children).toHaveLength(2);
  });

  it('marks Edit and Cancel with an icon each', () => {
    show(event);
    expect(edit().querySelector('svg')).toBeTruthy();
    expect(cancel().querySelector('svg')).toBeTruthy();
  });

  it('outlines the cancel, in the colour of what it does', () => {
    show(event);
    const classes = cancel().className.split(' ');
    expect(
      classes,
      'as red text with no border it read as a link, not as a button',
    ).toContain('btn-outline');
    expect(classes).toContain('btn-error');
    expect(classes).not.toContain('btn-ghost');
  });

  it('keeps the calendar and the chat on one line below them', () => {
    show(event, true);
    const row = calendar().parentElement;
    expect(chat().parentElement).toBe(row);
    expect(row).not.toBe(edit().parentElement);
  });

  it('labels that row short enough to share the side rail', () => {
    show(event, true);
    expect(
      calendar().querySelector('summary')?.textContent,
      'in full the two needed 401px of the 267px the side rail has in English',
    ).toBe('Calendar');
    expect(cancel().textContent).toBe('Cancel');
    expect(
      chat().textContent,
      'Open chat beside Calendar needed 281px of the 272px the rail has in English',
    ).toBe('Chat');
  });

  it('offers the chat by its button alone', () => {
    show(event, true);
    expect(
      screen.queryByRole('heading', { name: 'Chat' }),
      'a heading and a note above one button made the panel taller than the details beside it',
    ).toBeNull();
    expect(
      screen.queryByText(
        'Only the host and the people going can read this chat.',
      ),
    ).toBeNull();
  });

  it('leaves saying who hosts to the host card', () => {
    show(event);
    expect(
      screen.queryByText("You're hosting"),
      'the host card is where the page says who hosts, so the badge moved there',
    ).toBeNull();
  });

  it('says nothing about who sees the host in the room', () => {
    show(event);
    expect(
      screen.queryByText(/Guests see you in the room/i),
      'the host knows they are at their own meetup',
    ).toBeNull();
  });
});

describe("HostEventPanel opens the meetup's chat", () => {
  const chat = () => screen.queryByRole('button', { name: 'Chat' });

  it.each([
    ['ahead', event],
    ['over', ended],
    ['called off', cancelled],
  ])(
    'offers no chat where the market has it off, while the meetup is %s',
    (_case, item) => {
      show(item);
      expect(chat()).toBeNull();
    },
  );

  it.each([
    ['ahead', event],
    ['over', ended],
    ['called off', cancelled],
  ])('opens the chat while the meetup is %s', (_case, item) => {
    show(item, true);
    expect(chat()?.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it.each([
    ['under way', inProgress, 'w-full'],
    ['over', ended, 'w-fit'],
    ['called off', cancelled, 'w-fit'],
  ])(
    'sizes the chat of a meetup %s as the box of someone going does',
    (_case, item, width) => {
      show(item, true);
      expect(chat()?.className.split(' ')).toContain(width);
    },
  );
});
