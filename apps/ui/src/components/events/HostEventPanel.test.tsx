import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EventWithAttendance } from '@founders-coffee/server-fns';

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
}));

vi.mock('../../features/events/hooks', () => ({
  useCancelEvent: () => ({ mutate: vi.fn(), isPending: false }),
  useRepeatEventTemplate: () => ({ data: null }),
}));

vi.mock('./CancelEventDialog', () => ({ CancelEventDialog: () => null }));
vi.mock('./RepeatHostLink', () => ({ RepeatHostLink: () => null }));
vi.mock('./HostLiveActions', () => ({ HostLiveActions: () => null }));

const { HostEventPanel } = await import('./HostEventPanel');

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
  viewerRsvp: 'going',
} satisfies EventWithAttendance;

const cancelled = {
  ...event,
  status: 'cancelled',
  cancelledAt: new Date('2026-09-10T00:00:00Z'),
} satisfies EventWithAttendance;

const show = (item: EventWithAttendance) =>
  render(
    <HostEventPanel
      event={item}
      locale="en"
      marketSlug="algeria"
      live={null}
      isWindowOpen={false}
    />,
  );

afterEach(() => cleanup());

describe('HostEventPanel gives the host something to promote with', () => {
  it('offers the share the host is expected to put on WhatsApp', () => {
    show(event);
    expect(
      screen.getByRole('button', { name: 'Share this meetup' }),
    ).toBeTruthy();
  });

  it('stops offering it once the host has called the meetup off', () => {
    show(cancelled);
    expect(
      screen.queryByRole('button', { name: 'Share this meetup' }),
      'promoting a cancelled meetup sends people to a room nobody will be in',
    ).toBeNull();
  });
});
