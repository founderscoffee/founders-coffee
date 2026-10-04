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
vi.mock('../../features/chat/useChatAddress', () => ({
  useChatAddress: () => ({ isOpen: false, open: vi.fn(), close: vi.fn() }),
}));
vi.mock('../../features/chat/hooks', () => ({
  useChatUnreadCounts: () => new Map(),
}));
vi.mock('../../features/chat/chat-panel-loader', () => ({
  preloadChatConversation: vi.fn(),
}));
vi.mock('./RsvpCancelDialog', () => ({ RsvpCancelDialog: () => null }));
vi.mock('../../features/events/components/PushPermissionPrompt', () => ({
  PushPermissionPrompt: () => null,
}));

const { RsvpSection } = await import('./RsvpSection');

const INVITE = 'The people going talk in the meetup’s chat.';

const MEMBERS_ONLY = 'Only the host and the people going can read this chat.';

const going = { ...event, viewerRsvp: 'going' } satisfies EventWithAttendance;

const cancelled = {
  ...event,
  status: 'cancelled',
  cancelledAt: new Date('2026-09-19T10:00:00Z'),
} satisfies EventWithAttendance;

const chat = () => screen.queryByRole('button', { name: /^Open chat/ });

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
    expect(chat()).toBeNull();
  });

  it.each([
    ['ahead', 'upcoming'],
    ['under way', 'started'],
    ['over', 'ended'],
  ] as const)(
    'opens the chat for someone going while the meetup is %s',
    (_case, phase) => {
      show(going, phase);

      expect(chat()).toBeTruthy();
      expect(screen.queryByText(INVITE)).toBeNull();
    },
  );

  it('keeps the chat of a cancelled meetup open to the people who were going', () => {
    show({ ...cancelled, viewerRsvp: 'going' }, 'upcoming');

    expect(chat()).toBeTruthy();
  });

  it.each([
    ['ahead', going, 'upcoming'],
    ['over', going, 'ended'],
    ['called off', { ...cancelled, viewerRsvp: 'going' }, 'upcoming'],
  ] as const)(
    'offers the chat of a meetup %s as its button alone, without a heading or a line on who reads it',
    (_case, item, phase) => {
      show(item, phase);

      expect(chat()).toBeTruthy();
      expect(screen.queryByRole('heading', { name: 'Chat' })).toBeNull();
      expect(screen.queryByRole('region', { name: 'Chat' })).toBeNull();
      expect(screen.queryByText(MEMBERS_ONLY)).toBeNull();
    },
  );

  it.each([
    ['a cancelled meetup', cancelled, 'upcoming'],
    ['a meetup already under way', event, 'started'],
  ] as const)(
    'offers someone not going nothing of the chat on %s',
    (_case, item, phase) => {
      show(item, phase);

      expect(chat()).toBeNull();
      expect(screen.queryByText(INVITE)).toBeNull();
    },
  );

  it('shows nothing of the chat where the market has it switched off', () => {
    show(event, 'upcoming', false);
    expect(screen.queryByText(INVITE)).toBeNull();

    cleanup();
    show(going, 'upcoming', false);
    expect(chat()).toBeNull();
  });
});
