import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EventDetailItem } from '@founders-coffee/server-fns';

vi.mock('../../../components/host/DatetimePicker', () => ({
  DatetimePicker: () => null,
}));

const { EventEditForm, draftFromEvent, hasScheduleMoved } =
  await import('./EventEditForm');

const event = {
  id: 'evt_1',
  hostId: 'usr_1',
  marketCode: 'DZ',
  stateCode: '16',
  cityCode: 'algiers',
  title: 'Founders breakfast',
  description: 'A local founder meetup worth showing up to.',
  venue: 'Café Atlas',
  startsAt: new Date('2099-09-20T10:00:00Z'),
  endsAt: new Date('2099-09-20T12:00:00Z'),
  rsvps: 4,
  language: 'en',
  latitude: null,
  longitude: null,
  venueAddress: null,
  slug: 'founders-breakfast',
  status: 'published',
  version: 3,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-09-01T00:00:00Z'),
  cancelledAt: null,
  cancellationReason: null,
  goingCount: 4,
  viewerRsvp: 'going',
  cityName: 'Algiers',
  cityNameAr: 'الجزائر',
  citySlug: 'algiers',
} satisfies EventDetailItem;

const show = (draft = draftFromEvent(event)) =>
  render(
    <EventEditForm
      locale="en"
      event={event}
      timezone="Africa/Algiers"
      draft={draft}
      onDraftChange={() => undefined}
      onSubmit={() => undefined}
      isPending={false}
    />,
  );

afterEach(() => cleanup());

describe('what the host is told a save will do', () => {
  it('promises silence while the schedule is untouched', () => {
    show();

    expect(
      screen.getByText('No one will be notified of this edit.'),
      'a host fixing a typo should not be warned about messaging four people',
    ).toBeTruthy();
  });

  it('warns with a count as soon as the start moves', () => {
    show({
      ...draftFromEvent(event),
      startsAt: new Date('2099-09-20T11:00:00Z').getTime(),
    });

    expect(
      screen.getByText('Changing the time will notify 3 attendees.'),
      'the host holds an RSVP on their own event and is not notified, so the count they see must exclude them',
    ).toBeTruthy();
  });

  it('warns when only the end moves, because that is still a change of plan', () => {
    show({
      ...draftFromEvent(event),
      endsAt: new Date('2099-09-20T14:00:00Z').getTime(),
    });

    expect(screen.getByText(/will notify/)).toBeTruthy();
  });

  it('says nobody is affected when the host is the only one going', () => {
    render(
      <EventEditForm
        locale="en"
        event={{ ...event, goingCount: 1, rsvps: 1 }}
        timezone="Africa/Algiers"
        draft={{
          ...draftFromEvent(event),
          startsAt: new Date('2099-09-20T11:00:00Z').getTime(),
        }}
        onDraftChange={() => undefined}
        onSubmit={() => undefined}
        isPending={false}
      />,
    );

    expect(
      screen.getByText('No one will be notified of this edit.'),
      'a host whose meetup nobody has joined should not be warned about notifying 0 attendees',
    ).toBeTruthy();
  });
});

describe('the draft the form starts from', () => {
  it('is the event as published, so an untouched form saves nothing new', () => {
    const draft = draftFromEvent(event);

    expect(draft.title).toBe(event.title);
    expect(draft.venueName).toBe(event.venue);
    expect(hasScheduleMoved(event, draft)).toBe(false);
  });

  it('offers the venue name for editing, which is what #14 asks for', () => {
    show();

    expect(
      screen.getByDisplayValue('Café Atlas'),
      'a café that renames itself is the ordinary reason a host edits at all',
    ).toBeTruthy();
  });
});
