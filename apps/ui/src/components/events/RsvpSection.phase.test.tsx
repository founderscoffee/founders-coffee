import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@founders-coffee/core';
import type { EventWithAttendance } from '@founders-coffee/server-fns';

import type { EventPhase } from '../../features/events/live-window';
import { rsvpEvent as event } from './RsvpSection.fixtures';

const mocks = vi.hoisted(() => ({
  createRsvp: vi.fn(),
  isAuthenticated: true,
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useRouter: () => ({ invalidate: vi.fn() }),
}));

vi.mock('../../features/events/hooks', () => ({
  useCreateRsvp: () => ({ mutate: mocks.createRsvp, isPending: false }),
  useCancelRsvp: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../../lib/app-providers', () => ({
  useAuth: () => ({ isAuthenticated: mocks.isAuthenticated }),
}));

vi.mock('./HostEventPanel', () => ({ HostEventPanel: () => null }));
vi.mock('../../features/chat/components/ChatEntry', () => ({
  ChatEntry: () => null,
}));
vi.mock('./RsvpCancelDialog', () => ({ RsvpCancelDialog: () => null }));
vi.mock('../../features/events/components/PushPermissionPrompt', () => ({
  PushPermissionPrompt: () => null,
}));

const { RsvpSection } = await import('./RsvpSection');

type Live = Parameters<typeof RsvpSection>[0]['live'];

const liveRoom = {
  roster: [],
  host: null,
  connectionState: 'connected',
  error: null,
  notAttending: false,
  sendArrived: vi.fn(),
  sendWalkingIn: vi.fn(),
  sendRunningLate: vi.fn(),
  sendTablePin: vi.fn(),
  disconnect: vi.fn(),
} as unknown as Live;

const going = { ...event, viewerRsvp: 'going' } satisfies EventWithAttendance;

const show = (
  item: EventWithAttendance,
  phase: EventPhase,
  live: Live = null,
) =>
  render(
    <RsvpSection
      event={item}
      hostName="Amine"
      marketSlug="algeria"
      locale="en"
      isHost={false}
      live={live}
      isWindowOpen={phase === 'started'}
      phase={phase}
      isChatAvailable={false}
    />,
  );

const join = () => screen.queryByRole('button', { name: 'Join the meetup' });
const undo = () => screen.queryByRole('button', { name: 'Cancel RSVP' });
const calendar = () =>
  screen.queryByRole('group', { name: 'Add to your calendar' });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.isAuthenticated = true;
});

describe('RsvpSection once the meetup has started', () => {
  it.each([true, false])(
    'offers no seat to a reader who is not going (signed in: %s)',
    (isAuthenticated) => {
      mocks.isAuthenticated = isAuthenticated;
      show(event, 'started');

      expect(
        join(),
        'the server refuses every RSVP from the start on, so the button could only ever fail',
      ).toBeNull();
      expect(screen.getByText('This meetup has already started.')).toBeTruthy();
    },
  );

  it('keeps the seat of a member who is going, without the undo the server would refuse', () => {
    show(going, 'started');

    expect(undo()).toBeNull();
    expect(
      screen.queryByText(
        'Confirmation sent. We’ll remind you the day before the meetup.',
      ),
      'the reminder it promises has already gone out',
    ).toBeNull();
    expect(calendar()).toBeNull();
  });

  it('still lets them tell the room they are on their way', () => {
    show(going, 'started', liveRoom);

    expect(screen.getByRole('button', { name: 'I’m on my way' })).toBeTruthy();
  });
});

describe('RsvpSection once the meetup has ended', () => {
  it('offers a reader who did not go nothing to press', () => {
    show(event, 'ended');

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByText('This meetup has already started.')).toBeNull();
  });

  it('leaves a member who went nothing to undo', () => {
    show(going, 'ended');

    expect(undo()).toBeNull();
    expect(calendar()).toBeNull();
  });
});

describe('RsvpSection on a page left open across the start', () => {
  const failJoin = (cause: unknown) => {
    show(event, 'upcoming');
    fireEvent.click(screen.getByRole('button', { name: 'Join the meetup' }));
    const handlers = mocks.createRsvp.mock.calls[0]?.[1] as {
      onError?: (cause: unknown) => void;
    };
    act(() => handlers.onError?.(cause));
  };

  it('says why the seat is gone, and offers no retry that cannot work', () => {
    failJoin(new AppError('rsvp_closed', 'This gathering has already started'));

    expect(
      screen.getByText('This meetup has already started, so RSVPs are closed.'),
    ).toBeTruthy();
    expect(screen.queryByText('Something went wrong. Try again.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('keeps the retry for a failure that may pass', () => {
    failJoin(new Error('network'));

    expect(screen.getByText('Something went wrong. Try again.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});
