import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EventWithAttendance } from '@founders-coffee/server-fns';

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),
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
  version: 1,
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

const cancelledAndPast = {
  ...ended,
  status: 'cancelled',
  cancelledAt: at(-10 * HOUR),
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

describe('HostEventPanel leaves promoting to the page it sits on', () => {
  it('offers no share button of its own', () => {
    show(event);
    expect(
      screen.queryByRole('button', { name: 'Share this meetup' }),
      "the header chip already shares this page, and the host's own button was the same component, handler and URL a second time",
    ).toBeNull();
  });

  it('offers none on a cancelled meetup either', () => {
    show(cancelled);
    expect(
      screen.queryByRole('button', { name: 'Share this meetup' }),
    ).toBeNull();
  });
});

describe('HostEventPanel offers editing instead of only cancelling', () => {
  const editLink = () => screen.queryByRole('link', { name: 'Edit' });

  it('offers it while the meetup is still ahead', () => {
    show(event);
    expect(
      editLink(),
      'without it a host who mistypes the time can only cancel, which releases every booking (#14)',
    ).toBeTruthy();
  });

  it('stops offering it once the meetup has ended', () => {
    show(ended);
    expect(
      editLink(),
      'an edit is a claim about the future, and there is none left to change',
    ).toBeNull();
  });

  it('stops offering it once the host has called the meetup off', () => {
    show(cancelled);
    expect(editLink()).toBeNull();
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

describe('HostEventPanel stops describing a meetup that is over as one to come', () => {
  it('says the meetup has ended instead of who will see the host in the room', () => {
    show(ended);
    expect(
      screen.queryByText(/Guests see you in the room/i),
      'the line is about a room that opens before a start that has already passed',
    ).toBeNull();
    expect(screen.getByText('This meetup has ended.')).toBeTruthy();
  });

  it('stops explaining when the room opens, once it has opened and closed', () => {
    show(ended);
    expect(
      screen.queryByText(/The room opens an hour before/i),
      'one string cannot describe both not yet open and already over',
    ).toBeNull();
  });

  it('still explains the room while the meetup is ahead', () => {
    show(event);
    expect(screen.getByText(/The room opens an hour before/i)).toBeTruthy();
    expect(screen.queryByText('This meetup has ended.')).toBeNull();
  });

  it('offers the closeout once the meetup has ended', () => {
    show(ended);
    expect(
      screen.queryByRole('link', { name: 'Close it out' }),
      'the event page is where a host who just finished looks, and it was reachable only from the activity page',
    ).toBeTruthy();
  });

  it('offers no closeout while the meetup is still ahead', () => {
    show(event);
    expect(screen.queryByRole('link', { name: 'Close it out' })).toBeNull();
  });

  it('offers no closeout for a meetup the host called off, once its hour has passed', () => {
    show(cancelledAndPast);
    expect(
      screen.queryByRole('link', { name: 'Close it out' }),
      'a cancelled gathering cannot be closed out, so the link would lead to a refusal',
    ).toBeNull();
  });

  it('treats a meetup with no recorded end as one still to come', () => {
    show(endless);
    expect(screen.queryByText('This meetup has ended.')).toBeNull();
  });
});
