import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EventWithAttendance } from '@founders-coffee/server-fns';

import type { EventPhase } from '../../features/events/live-window';
import { rsvpEvent as event } from './RsvpSection.fixtures';

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
vi.mock('./AddToCalendar', () => ({ AddToCalendar: () => null }));
vi.mock('../../features/chat/components/ChatEntry', () => ({
  ChatEntry: () => <p>chat-entry</p>,
}));
vi.mock('./RsvpCancelDialog', () => ({ RsvpCancelDialog: () => null }));
vi.mock('../../features/events/components/PushPermissionPrompt', () => ({
  PushPermissionPrompt: () => null,
}));

const { RsvpSection } = await import('./RsvpSection');

const INVITE = 'The people going talk in the meetup’s chat.';

const going = { ...event, viewerRsvp: 'going' } satisfies EventWithAttendance;

const cancelled = {
  ...event,
  status: 'cancelled',
  cancelledAt: new Date('2026-09-19T10:00:00Z'),
} satisfies EventWithAttendance;

const show = (
  item: EventWithAttendance,
  phase: EventPhase,
  isChatAvailable = true,
) =>
  render(
    <RsvpSection
      event={item}
      hostName="Amine"
      marketSlug="algeria"
      locale="en"
      isHost={false}
      live={null}
      isWindowOpen={false}
      phase={phase}
      isChatAvailable={isChatAvailable}
    />,
  );

afterEach(cleanup);

describe('RsvpSection and the meetup’s chat', () => {
  it('tells someone deciding that the people going talk in a chat', () => {
    show(event, 'upcoming');

    expect(screen.getByText(INVITE)).toBeTruthy();
    expect(screen.queryByText('chat-entry')).toBeNull();
  });

  it.each([
    ['ahead', 'upcoming'],
    ['under way', 'started'],
    ['over', 'ended'],
  ] as const)(
    'opens the chat for someone going while the meetup is %s',
    (_case, phase) => {
      show(going, phase);

      expect(screen.getByText('chat-entry')).toBeTruthy();
      expect(screen.queryByText(INVITE)).toBeNull();
    },
  );

  it('keeps the chat of a cancelled meetup open to the people who were going', () => {
    show({ ...cancelled, viewerRsvp: 'going' }, 'upcoming');

    expect(screen.getByText('chat-entry')).toBeTruthy();
  });

  it.each([
    ['a cancelled meetup', cancelled, 'upcoming'],
    ['a meetup already under way', event, 'started'],
  ] as const)(
    'offers someone not going nothing of the chat on %s',
    (_case, item, phase) => {
      show(item, phase);

      expect(screen.queryByText('chat-entry')).toBeNull();
      expect(screen.queryByText(INVITE)).toBeNull();
    },
  );

  it('shows nothing of the chat where the market has it switched off', () => {
    show(event, 'upcoming', false);
    expect(screen.queryByText(INVITE)).toBeNull();

    cleanup();
    show(going, 'upcoming', false);
    expect(screen.queryByText('chat-entry')).toBeNull();
  });
});
