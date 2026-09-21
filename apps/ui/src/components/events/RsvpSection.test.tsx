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
  it('confirms attendance in the words the rest of the flow uses', () => {
    show({ ...event, viewerRsvp: 'going' }, 'ar');

    expect(screen.getByText('حضورك مؤكَّد')).toBeTruthy();
    expect(screen.queryByText('أنت قادم')).toBeNull();
  });

  it('states the confirmation was sent, rather than appearing to demand it', () => {
    show({ ...event, viewerRsvp: 'going' }, 'ar');

    expect(screen.getByText('تم إرسال التأكيد. سنذكّرك قبل يوم.')).toBeTruthy();
  });
});

describe('where the undo for a confirmed seat sits', () => {
  it('puts cancel in the status row, beside the thing it undoes', () => {
    show({ ...event, viewerRsvp: 'going' });

    const cancel = screen.getByRole('button', { name: 'Cancel RSVP' });
    const pill = screen.getByText("You're going");

    expect(
      cancel.parentElement?.contains(pill),
      "cancel is the status's own undo and belongs on the same row as the status",
    ).toBe(true);
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
