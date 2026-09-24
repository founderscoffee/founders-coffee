import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EventWithAttendance } from '@founders-coffee/server-fns';

import { rsvpEvent } from './RsvpSection.fixtures';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useRouter: () => ({ invalidate: vi.fn() }),
}));

vi.mock('../../features/events/hooks', () => ({
  useCreateRsvp: () => ({ mutate: vi.fn(), isPending: false }),
  useCancelRsvp: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../lib/app-providers', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock('./HostEventPanel', () => ({ HostEventPanel: () => null }));
vi.mock('../../features/telegram/components/TelegramGroupCard', () => ({
  TelegramGroupCard: () => <p>telegram-group</p>,
}));
vi.mock('./RsvpCancelDialog', () => ({ RsvpCancelDialog: () => null }));
vi.mock('../../features/events/components/PushPermissionPrompt', () => ({
  PushPermissionPrompt: () => null,
}));

const { RsvpSection } = await import('./RsvpSection');

const HOUR = 60 * 60 * 1000;
const at = (offset: number) => new Date(Date.now() + offset);

const upcoming = {
  ...rsvpEvent,
  startsAt: at(24 * HOUR),
  endsAt: at(26 * HOUR),
} satisfies EventWithAttendance;

const show = (item: EventWithAttendance) =>
  render(
    <RsvpSection
      event={item}
      hostName="Amine"
      marketSlug="algeria"
      locale="en"
      isHost={false}
      live={null}
      isWindowOpen={false}
    />,
  );

const calendarGroup = () =>
  screen.queryByRole('group', { name: 'Add to your calendar' });

afterEach(() => cleanup());

describe('RsvpSection offers the meetup to a calendar once the seat is taken', () => {
  it('offers it to someone who is going', () => {
    show({ ...upcoming, viewerRsvp: 'going' });

    expect(calendarGroup()).toBeTruthy();
    expect(
      screen
        .getByRole('link', { name: 'Google Calendar' })
        .getAttribute('href'),
    ).toBe('/cal/e/1?l=en&to=google');
  });

  it('offers nothing before the seat is taken', () => {
    show(upcoming);

    expect(
      calendarGroup(),
      'the page already has one call to action, and a meetup in a calendar is a promise the RSVP makes',
    ).toBeNull();
  });

  it('offers nothing once the host has called the meetup off, even to someone who was going', () => {
    show({
      ...upcoming,
      viewerRsvp: 'going',
      status: 'cancelled',
      cancelledAt: at(-HOUR),
    });

    expect(calendarGroup()).toBeNull();
  });
});
