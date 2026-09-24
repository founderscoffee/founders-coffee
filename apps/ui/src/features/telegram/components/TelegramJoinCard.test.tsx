import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TelegramGroupView } from '../api';

const mocks = vi.hoisted(() => ({ requestInvite: vi.fn() }));

vi.mock('../hooks', () => ({
  useRequestTelegramInvite: () => ({
    mutate: mocks.requestInvite,
    isPending: false,
  }),
}));

const { TelegramJoinCard } = await import('./TelegramJoinCard');

type AttendeeView = Extract<TelegramGroupView, { role: 'attendee' }>;

const INVITE = 'https://t.me/+member-invite';

const show = (view: AttendeeView, locale: 'ar' | 'fr' | 'en' = 'en') =>
  render(<TelegramJoinCard eventId="evt_1" locale={locale} view={view} />);

type Handlers = {
  onSuccess?: (data: unknown) => void;
  onError?: (cause: unknown) => void;
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TelegramJoinCard', () => {
  it('says who will see the member before they ask for a link', () => {
    show({ role: 'attendee', inviteLink: null, hasJoined: false });

    expect(
      screen.getByText(
        'Everyone in the group can see your Telegram profile and message you there. Whether they see your phone number depends on your Telegram privacy settings.',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Get my invite link' }));
    expect(mocks.requestInvite).toHaveBeenCalledTimes(1);
  });

  it('puts focus on their link as soon as it is made', () => {
    const { rerender } = show({
      role: 'attendee',
      inviteLink: null,
      hasJoined: false,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Get my invite link' }));

    act(() =>
      (mocks.requestInvite.mock.calls[0]?.[1] as Handlers).onSuccess?.({
        inviteLink: INVITE,
      }),
    );
    rerender(
      <TelegramJoinCard
        eventId="evt_1"
        locale="en"
        view={{ role: 'attendee', inviteLink: INVITE, hasJoined: false }}
      />,
    );

    expect(document.activeElement).toBe(
      screen.getByRole('link', { name: 'Join in Telegram' }),
    );
  });

  it('opens their own link in Telegram once they have one', () => {
    show({ role: 'attendee', inviteLink: INVITE, hasJoined: false });

    const join = screen.getByRole('link', { name: 'Join in Telegram' });
    expect(join.getAttribute('href')).toBe(INVITE);
    expect(join.getAttribute('target')).toBe('_blank');
    expect(join.getAttribute('rel')).toBe('noopener noreferrer');
    expect(
      screen.queryByRole('button', { name: 'Get my invite link' }),
    ).toBeNull();
  });

  it('tells a member who is in the group so, and takes them to it', () => {
    show({ role: 'attendee', inviteLink: INVITE, hasJoined: true });

    expect(screen.getByText("You're in the group.")).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'Open the group in Telegram' })
        .getAttribute('href'),
    ).toBe(INVITE);
  });

  it('says when the group is no longer taking anyone', () => {
    show({ role: 'attendee', inviteLink: null, hasJoined: false });
    fireEvent.click(screen.getByRole('button', { name: 'Get my invite link' }));

    act(() =>
      (mocks.requestInvite.mock.calls[0]?.[1] as Handlers).onError?.({
        code: 'telegram_group_unavailable',
      }),
    );

    expect(
      screen.getByText("This meetup's group isn't taking new members."),
    ).toBeTruthy();
  });

  it.each([
    ['fr', 'Rejoindre dans Telegram'],
    ['ar', 'انضمّ عبر تيليغرام'],
  ] as const)('reads in %s', (locale, label) => {
    show({ role: 'attendee', inviteLink: INVITE, hasJoined: false }, locale);

    expect(screen.getByRole('link', { name: label })).toBeTruthy();
  });
});
