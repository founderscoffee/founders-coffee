import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Locale } from '@founders-coffee/i18n';

vi.mock('../../features/chat/useChatAddress', () => ({
  useChatAddress: () => ({ isOpen: false, open: vi.fn(), close: vi.fn() }),
}));
vi.mock('../../features/chat/hooks', () => ({
  useChatUnreadCounts: () => new Map(),
}));
vi.mock('../../features/chat/chat-panel-loader', () => ({
  preloadChatConversation: vi.fn(),
}));

const { CalendarChatActions } = await import('./CalendarChatActions');

const HOUR = 60 * 60 * 1000;

type Offer = {
  isOver?: boolean;
  isCalendarOffered?: boolean;
  isChatAvailable?: boolean;
  locale?: Locale;
};

const show = ({
  isOver = false,
  isCalendarOffered = true,
  isChatAvailable = true,
  locale = 'en',
}: Offer = {}) =>
  render(
    <CalendarChatActions
      locale={locale}
      eventId="evt_25b03363854e4768887f4f96641e6667"
      startsAt={new Date(Date.now() + 24 * HOUR)}
      isOver={isOver}
      isCalendarOffered={isCalendarOffered}
      isChatAvailable={isChatAvailable}
    />,
  );

const calendar = (name = 'Add to your calendar') =>
  screen.queryByRole('group', { name });
const chat = (name = /^Chat/) => screen.queryByRole('button', { name });
const classesOf = (element: Element | null | undefined) =>
  element?.className.split(' ') ?? [];

afterEach(() => cleanup());

describe('CalendarChatActions', () => {
  it('puts the calendar and the chat side by side, each filling its half', () => {
    show();
    const row = calendar()?.parentElement;

    expect(chat()?.parentElement).toBe(row);
    expect(row?.children).toHaveLength(2);
    expect(classesOf(row)).toContain('auto-cols-[1fr]');
    expect(classesOf(calendar()?.querySelector('summary'))).toContain('w-full');
    expect(classesOf(chat())).toContain('w-full');
  });

  it.each([
    ['en', 'Add to your calendar', 'Calendar', /^Chat/],
    ['fr', 'Ajouter à votre agenda', 'Agenda', /^Discuter/],
    ['ar', 'أضف إلى تقويمك', 'التقويم', /^المحادثة/],
  ] as const)(
    'labels both buttons one way for the host and the people going (%s)',
    (locale, name, calendarLabel, chatLabel) => {
      show({ locale });

      expect(calendar(name)?.querySelector('summary')?.textContent).toBe(
        calendarLabel,
      );
      expect(chat(chatLabel)).toBeTruthy();
    },
  );

  it('gives the whole row to the calendar where the chat is off', () => {
    show({ isChatAvailable: false });

    expect(calendar()?.parentElement?.children).toHaveLength(1);
    expect(chat()).toBeNull();
  });

  it('gives the whole row to the chat once the meetup has started', () => {
    show({ isCalendarOffered: false });

    expect(calendar()).toBeNull();
    expect(chat()?.parentElement?.children).toHaveLength(1);
    expect(classesOf(chat())).toContain('w-full');
  });

  it('keeps the chat at its own width once the meetup is over or called off', () => {
    show({ isOver: true });

    expect(
      calendar(),
      'a calendar entry for a meetup that is over or called off reminds nobody of anything',
    ).toBeNull();
    expect(classesOf(chat())).toContain('w-fit');
    expect(classesOf(chat()?.parentElement)).not.toContain('auto-cols-[1fr]');
  });

  it.each([
    ['over, with the chat off', { isOver: true, isChatAvailable: false }],
    [
      'under way, with the chat off',
      { isCalendarOffered: false, isChatAvailable: false },
    ],
  ])('leaves no empty row once the meetup is %s', (_case, offer) => {
    const { container } = show(offer);

    expect(container.innerHTML).toBe('');
  });
});
