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

const show = (item: EventWithAttendance) =>
  render(
    <RsvpSection
      event={item}
      hostName="Amine"
      marketSlug="algeria"
      locale="en"
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

describe('RsvpSection invites a founder once the seat is taken', () => {
  it('offers the invite only after the reader has said yes', () => {
    show(event);
    expect(
      screen.queryByRole('button', { name: 'Invite a founder' }),
      'there is nothing to invite anyone to until the reader is going themselves',
    ).toBeNull();

    cleanup();
    show({ ...event, viewerRsvp: 'going' });
    expect(
      screen.getByRole('button', { name: 'Invite a founder' }),
    ).toBeTruthy();
  });

  it('does not ask anyone to promote a meetup that is off', () => {
    show({ ...cancelled, viewerRsvp: 'going' });
    expect(
      screen.queryByRole('button', { name: 'Invite a founder' }),
    ).toBeNull();
  });
});
