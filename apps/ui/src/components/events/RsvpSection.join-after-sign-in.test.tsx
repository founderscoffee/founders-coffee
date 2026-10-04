import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EventWithAttendance } from '@founders-coffee/server-fns';

import {
  rememberJoinIntent,
  takeJoinIntent,
} from '../../features/events/join-intent';
import type { EventPhase } from '../../features/events/live-window';
import { rsvpEvent as event } from './RsvpSection.fixtures';

const mocks = vi.hoisted(() => ({
  auth: { isAuthenticated: false },
  navigate: vi.fn(),
  invalidate: vi.fn(),
  createRsvp: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mocks.navigate,
  useRouter: () => ({ invalidate: mocks.invalidate }),
}));

vi.mock('../../features/events/hooks', () => ({
  useCreateRsvp: () => ({ mutate: mocks.createRsvp, isPending: false }),
  useCancelRsvp: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../lib/app-providers', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('./HostEventPanel', () => ({ HostEventPanel: () => null }));
vi.mock('../../features/chat/components/ChatOpenButton', () => ({
  ChatOpenButton: () => null,
}));
vi.mock('../../features/events/components/PushPermissionPrompt', () => ({
  PushPermissionPrompt: () => null,
}));

const { RsvpSection } = await import('./RsvpSection');

type Shown = {
  item?: EventWithAttendance;
  isHost?: boolean;
  phase?: EventPhase;
};

const section = ({
  item = event,
  isHost = false,
  phase = 'upcoming',
}: Shown = {}) => (
  <RsvpSection
    event={item}
    hostName="Amine"
    marketSlug="algeria"
    locale="en"
    isHost={isHost}
    live={null}
    isWindowOpen={false}
    phase={phase}
    isChatAvailable={false}
  />
);

const joinedEvents = () =>
  mocks.createRsvp.mock.calls.map(
    ([input]) => (input as { data: { eventId: string } }).data.eventId,
  );

beforeEach(() => {
  window.sessionStorage.clear();
  mocks.auth.isAuthenticated = false;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Join pressed by a reader who is not signed in', () => {
  it('sends them to sign in and back, remembering what they pressed', () => {
    render(section());

    fireEvent.click(screen.getByRole('button', { name: 'Join the meetup' }));

    expect(mocks.navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '/$locale/login',
        search: { redirect: window.location.pathname },
      }),
    );
    expect(mocks.createRsvp).not.toHaveBeenCalled();
    expect(takeJoinIntent(event.id)).toBe(true);
  });
});

describe('the meetup page sign-in brings that reader back to', () => {
  it('takes their seat without a second press', () => {
    rememberJoinIntent(event.id);
    mocks.auth.isAuthenticated = true;

    render(section());

    expect(
      joinedEvents(),
      'on 2 October a reader pressed Join, signed in, came back to the same button and left without pressing it again',
    ).toEqual([event.id]);
  });

  it('finishes the join the way a press does', () => {
    rememberJoinIntent(event.id);
    mocks.auth.isAuthenticated = true;
    render(section());

    const [, handlers] = mocks.createRsvp.mock.calls[0] ?? [];
    (handlers as { onSuccess?: () => void } | undefined)?.onSuccess?.();

    expect(mocks.invalidate).toHaveBeenCalledTimes(1);
  });

  it('waits for the session before joining', () => {
    rememberJoinIntent(event.id);
    const { rerender } = render(section());
    expect(mocks.createRsvp).not.toHaveBeenCalled();
    expect(
      mocks.navigate,
      'acting before the session answers would send a reader who is still signed out straight back to sign in',
    ).not.toHaveBeenCalled();

    mocks.auth.isAuthenticated = true;
    rerender(section());

    expect(joinedEvents()).toEqual([event.id]);
  });

  it('joins once, however often the page renders', () => {
    rememberJoinIntent(event.id);
    mocks.auth.isAuthenticated = true;

    const { rerender } = render(<StrictMode>{section()}</StrictMode>);
    rerender(<StrictMode>{section()}</StrictMode>);
    rerender(<StrictMode>{section()}</StrictMode>);

    expect(joinedEvents()).toEqual([event.id]);
  });

  it('brings the seat into view, since the reader lands at the top of the page', () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    rememberJoinIntent(event.id);
    mocks.auth.isAuthenticated = true;

    try {
      render(section());

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
    } finally {
      Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    }
  });
});

describe('a meetup page that owes nobody a seat', () => {
  it('joins no one who did not press Join', () => {
    mocks.auth.isAuthenticated = true;

    render(section());

    expect(mocks.createRsvp).not.toHaveBeenCalled();
  });

  it('joins no one to a meetup other than the one they pressed Join on', () => {
    rememberJoinIntent('evt_elsewhere');
    mocks.auth.isAuthenticated = true;

    render(section());

    expect(mocks.createRsvp).not.toHaveBeenCalled();
  });

  it.each<[string, Shown]>([
    ['they are already going to', { item: { ...event, viewerRsvp: 'going' } }],
    [
      'has been called off',
      {
        item: {
          ...event,
          status: 'cancelled',
          cancelledAt: new Date('2026-09-10T00:00:00Z'),
        },
      },
    ],
    ['has started', { phase: 'started' }],
    ['has ended', { phase: 'ended' }],
    ['they host', { isHost: true }],
  ])('joins no one to a meetup %s, and forgets the press', (_, shown) => {
    rememberJoinIntent(event.id);
    mocks.auth.isAuthenticated = true;

    render(section(shown));

    expect(mocks.createRsvp).not.toHaveBeenCalled();
    expect(takeJoinIntent(event.id)).toBe(false);
  });
});
