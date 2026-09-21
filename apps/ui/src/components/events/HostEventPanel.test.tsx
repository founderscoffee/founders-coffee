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

const HOUR = 60 * 60 * 1000;
const at = (offset: number) => new Date(Date.now() + offset);

const event = {
  id: 'evt_1',
  hostId: 'usr_1',
  marketCode: 'DZ',
  stateCode: '16',
  cityCode: 'algiers',
  title: 'Founders breakfast',
  description: 'A local founder meetup.',
  venue: 'Café Atlas',
  startsAt: at(24 * HOUR),
  endsAt: at(26 * HOUR),
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
  cancelledAt: at(-10 * HOUR),
} satisfies EventWithAttendance;

const inProgress = {
  ...event,
  startsAt: at(-HOUR),
  endsAt: at(HOUR),
} satisfies EventWithAttendance;

const ended = {
  ...event,
  startsAt: at(-4 * HOUR),
  endsAt: at(-2 * HOUR),
} satisfies EventWithAttendance;

const endless = {
  ...event,
  startsAt: at(-4 * HOUR),
  endsAt: null,
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

describe('HostEventPanel offers cancelling only while there is something to cancel', () => {
  const cancelButton = () =>
    screen.queryByRole('button', { name: 'Cancel this meetup' });

  it('offers it while the meetup is still ahead', () => {
    show(event);
    expect(cancelButton()).toBeTruthy();
  });

  it('still offers it while the meetup is under way', () => {
    show(inProgress);
    expect(
      cancelButton(),
      'a meetup can collapse in its first ten minutes, and the host needs to be able to say so',
    ).toBeTruthy();
  });

  it('stops offering it once the meetup has ended', () => {
    show(ended);
    expect(
      cancelButton(),
      'cancelling a meetup that already happened tells everyone who came that it was cancelled, and then blocks the closeout, the feedback and the repeat template for good, with no way back',
    ).toBeNull();
  });

  it('offers it for a meetup with no end, which cannot be shown to have finished', () => {
    show(endless);
    expect(cancelButton()).toBeTruthy();
  });

  it('stops offering it once the host has called the meetup off', () => {
    show(cancelled);
    expect(cancelButton()).toBeNull();
  });
});
