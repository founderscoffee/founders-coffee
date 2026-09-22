import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EventWithAttendance } from '@founders-coffee/server-fns';

const mocks = vi.hoisted(() => ({
  invalidate: vi.fn(),
  createRsvp: vi.fn(),
  cancelRsvp: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useRouter: () => ({ invalidate: mocks.invalidate }),
}));

vi.mock('../../features/events/hooks', () => ({
  useCreateRsvp: () => ({ mutate: mocks.createRsvp, isPending: false }),
  useCancelRsvp: () => ({ mutate: mocks.cancelRsvp, isPending: false }),
}));

vi.mock('../../lib/app-providers', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock('./HostEventPanel', () => ({ HostEventPanel: () => null }));
vi.mock('./RsvpCancelDialog', () => ({
  RsvpCancelDialog: ({
    isOpen,
    onConfirm,
  }: {
    isOpen: boolean;
    onConfirm: () => void;
  }) =>
    isOpen ? (
      <button type="button" onClick={onConfirm}>
        confirm-cancel
      </button>
    ) : null,
}));
vi.mock('../../features/events/components/PushPermissionPrompt', () => ({
  PushPermissionPrompt: () => null,
}));

const { RsvpSection } = await import('./RsvpSection');

const event = {
  id: 'evt_1',
  hostId: 'usr_1',
  marketCode: 'DZ',
  stateCode: '16',
  cityCode: 'algiers',
  title: 'Founders breakfast',
  description: 'A local founder meetup.',
  venue: 'Café Atlas',
  startsAt: new Date('2026-09-20T10:00:00Z'),
  endsAt: new Date('2026-09-20T12:00:00Z'),
  rsvps: 3,
  language: 'en',
  latitude: null,
  longitude: null,
  venueAddress: null,
  slug: 'founders-breakfast',
  status: 'published',
  version: 1,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-09-01T00:00:00Z'),
  cancelledAt: null,
  cancellationReason: null,
  goingCount: 3,
  viewerRsvp: null,
} satisfies EventWithAttendance;

const cancelled = {
  ...event,
  status: 'cancelled',
  cancelledAt: new Date('2026-09-10T00:00:00Z'),
} satisfies EventWithAttendance;

const liveRoom = (overrides: Record<string, unknown> = {}) =>
  ({
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
    ...overrides,
  }) as unknown as Parameters<typeof RsvpSection>[0]['live'];

const show = (item: EventWithAttendance, locale: 'ar' | 'en' = 'en') =>
  render(
    <RsvpSection
      event={item}
      hostName="Amine"
      marketSlug="algeria"
      locale={locale}
      isHost={false}
      live={null}
      isWindowOpen={true}
    />,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

type MutateHandlers = { onSuccess?: () => void };

const handlersOf = (spy: { mock: { calls: unknown[][] } }): MutateHandlers =>
  (spy.mock.calls[0]?.[1] ?? {}) as MutateHandlers;

describe('RsvpSection when the host has called the meetup off', () => {
  it('offers the seat while the meetup is still on', () => {
    show(event);
    expect(
      screen.getByRole('button', { name: 'Join the meetup' }),
    ).toBeTruthy();
  });

  it('withdraws the offer once it is cancelled', () => {
    show(cancelled);
    expect(
      screen.queryByRole('button', { name: 'Join the meetup' }),
    ).toBeNull();
  });

  it('tells whoever had said yes that they are off the hook', () => {
    show({ ...cancelled, viewerRsvp: 'going' });
    expect(screen.getByText('You had confirmed you were coming.')).toBeTruthy();
    expect(
      screen.getByText(
        'There is nothing to cancel, and the reminder we had scheduled will not be sent.',
      ),
    ).toBeTruthy();
  });

  it('does not ask them to cancel an RSVP to a meetup that is already off', () => {
    show({ ...cancelled, viewerRsvp: 'going' });
    expect(screen.queryByRole('button', { name: 'Cancel RSVP' })).toBeNull();
  });
});

describe('RsvpSection leaves sharing to the page it sits on', () => {
  it('offers no share button of its own once the seat is taken', () => {
    show({ ...event, viewerRsvp: 'going' });

    expect(
      screen.queryByRole('button', { name: 'Share' }),
      'the event page already carries one share chip, and a second identical button beside it is the same offer twice',
    ).toBeNull();
  });

  it('offers none before the reader has said yes either', () => {
    show(event);
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });
});

describe('what a confirmed attendee reads in Arabic', () => {
  it('states the confirmation was sent, rather than appearing to demand it', () => {
    show({ ...event, viewerRsvp: 'going' }, 'ar');

    expect(screen.getByText('تم إرسال التأكيد. سنذكّرك قبل يوم.')).toBeTruthy();
  });
});

describe('where the undo for a confirmed seat sits', () => {
  it('states the seat is taken once, in the heading the panel sits under', () => {
    show({ ...event, viewerRsvp: 'going' }, 'ar');

    expect(
      screen.queryByText('حضورك مؤكَّد'),
      'the status is the section heading now, and repeating it inside the panel is the same sentence twice',
    ).toBeNull();
  });

  it('leads with the undo, so nothing stands between it and the status above', () => {
    show({ ...event, viewerRsvp: 'going' });

    const cancel = screen.getByRole('button', { name: 'Cancel RSVP' });

    expect(cancel.previousElementSibling).toBeNull();
  });

  it('keeps the help line after the undo, not between it and the status', () => {
    show({ ...event, viewerRsvp: 'going' });

    const cancel = screen.getByRole('button', { name: 'Cancel RSVP' });
    const help = screen.getByText(
      'Confirmation sent. We’ll remind you the day before.',
    );

    expect(
      Boolean(
        cancel.compareDocumentPosition(help) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
  });
});

describe('telling the room you are on your way', () => {
  const showLive = (
    live: Parameters<typeof RsvpSection>[0]['live'],
    isWindowOpen: boolean,
  ) =>
    render(
      <RsvpSection
        event={{ ...event, viewerRsvp: 'going' }}
        hostName="Amine"
        marketSlug="algeria"
        locale="ar"
        isHost={false}
        live={live}
        isWindowOpen={isWindowOpen}
      />,
    );

  it('offers it in the panel, where the seat it belongs to already is', () => {
    showLive(liveRoom(), true);

    expect(
      screen.getByRole('button', { name: 'أمشي نحو المكان' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'سأتأخر' })).toBeTruthy();
  });

  it('offers nothing before the room opens, when there is no one to tell', () => {
    showLive(liveRoom(), false);

    expect(
      screen.queryByRole('button', { name: 'أمشي نحو المكان' }),
    ).toBeNull();
  });

  it('offers nothing to a reader the room has refused', () => {
    showLive(liveRoom({ notAttending: true }), true);

    expect(
      screen.queryByRole('button', { name: 'أمشي نحو المكان' }),
    ).toBeNull();
  });

  it('keeps the undo away from the live actions, behind a separator', () => {
    showLive(liveRoom(), true);

    const cancel = screen.getByRole('button', { name: 'إلغاء الحضور' });
    const walking = screen.getByRole('button', { name: 'أمشي نحو المكان' });

    expect(
      Boolean(
        cancel.compareDocumentPosition(walking) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      ),
      'cancel is destructive and must not sit next to the button a reader taps while walking',
    ).toBe(true);
    expect(cancel.nextElementSibling?.contains(walking)).toBe(false);
  });
});

describe('what a settled RSVP asks the page to do next', () => {
  it('refetches the route after joining, which is what reopens the live room', () => {
    show(event);

    fireEvent.click(screen.getByRole('button', { name: 'Join the meetup' }));
    expect(mocks.createRsvp).toHaveBeenCalledTimes(1);

    const { onSuccess } = handlersOf(mocks.createRsvp);
    expect(
      typeof onSuccess,
      'the mutation is fired with no success handler at all, so nothing below can run',
    ).toBe('function');
    onSuccess?.();

    expect(
      mocks.invalidate,
      'joining does not reopen the live room by itself: the room is gated on the loader’s viewerRsvp, and only this refetch flips it. Without it the member sits on the pre-join view until they reload by hand, which is the third symptom #36 was filed for',
    ).toHaveBeenCalledTimes(1);
  });

  it('refetches the route after cancelling, so the page stops saying they are coming', () => {
    show({ ...event, viewerRsvp: 'going' });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel RSVP' }));
    fireEvent.click(screen.getByRole('button', { name: 'confirm-cancel' }));
    expect(mocks.cancelRsvp).toHaveBeenCalledTimes(1);

    handlersOf(mocks.cancelRsvp).onSuccess?.();

    expect(
      mocks.invalidate,
      'the seat is released on the server but the page still renders from the loader it was given, so without this refetch it keeps offering to cancel an RSVP that no longer exists',
    ).toHaveBeenCalledTimes(1);
  });
});
