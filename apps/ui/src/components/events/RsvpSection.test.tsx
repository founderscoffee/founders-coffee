import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EventWithAttendance } from '@founders-coffee/server-fns';

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
vi.mock('./RsvpCancelDialog', () => ({ RsvpCancelDialog: () => null }));
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

afterEach(() => cleanup());

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
    expect(screen.getByRole('button', { name: 'متأخر' })).toBeTruthy();
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
