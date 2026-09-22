import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EventDetailItem } from '@founders-coffee/server-fns';

import {
  draftFromEvent,
  hasScheduleMoved,
  type EventEditDraft,
} from '../event-edit-draft';
import type { VenueSelection } from '../types';

vi.mock('../../../components/host/DatetimePicker', () => ({
  DatetimePicker: () => null,
}));

vi.mock('./EventEditVenue', () => ({
  EventEditVenue: () => <div data-testid="edit-venue" />,
}));

const { EventEditForm } = await import('./EventEditForm');

const event = {
  id: 'evt_1',
  hostId: 'usr_1',
  marketCode: 'DZ',
  stateCode: '16',
  cityCode: '556',
  title: 'Founders breakfast',
  description: 'A local founder meetup worth showing up to.',
  venue: 'Café Atlas',
  startsAt: new Date('2099-09-20T10:00:00Z'),
  endsAt: new Date('2099-09-20T12:00:00Z'),
  rsvps: 4,
  language: 'en',
  latitude: 36.7538,
  longitude: 3.0588,
  venueAddress: '12 Rue des Entrepreneurs, Alger',
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

const ACROSS_TOWN: VenueSelection = {
  providerId: 'osm:1234',
  kind: 'poi',
  name: 'Café Tantonville',
  address: '5 Place Port Saïd, Alger',
  latitude: 36.7558,
  longitude: 3.0588,
};

const LATER = new Date('2099-09-20T11:00:00Z').getTime();

const show = (
  draft: EventEditDraft = draftFromEvent(event),
  over: Partial<EventDetailItem> = {},
) =>
  render(
    <EventEditForm
      locale="en"
      event={{ ...event, ...over }}
      timezone="Africa/Algiers"
      mapboxToken="pk.test"
      draft={draft}
      onDraftChange={() => undefined}
      onSubmit={() => undefined}
      isPending={false}
    />,
  );

afterEach(() => cleanup());

describe('what the host is told a save will do', () => {
  it('promises silence while nothing that matters has changed', () => {
    show();

    expect(
      screen.getByText('No one will be notified of this edit.'),
      'a host fixing a typo should not be warned about messaging four people',
    ).toBeTruthy();
  });

  it('warns with a count as soon as the start moves', () => {
    show({ ...draftFromEvent(event), startsAt: LATER });

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

  it('warns when the café moves, even though the hour is untouched', () => {
    show({ ...draftFromEvent(event), venue: ACROSS_TOWN });

    expect(
      screen.getByText('Changing the place will notify 3 attendees.'),
      'somebody walking to the old address has to be told, and telling them the time changed would be a lie',
    ).toBeTruthy();
  });

  it('names both when the host moves the hour and the café at once', () => {
    show({ ...draftFromEvent(event), venue: ACROSS_TOWN, startsAt: LATER });

    expect(
      screen.getByText('Changing the time and place will notify 3 attendees.'),
    ).toBeTruthy();
  });

  it('stays quiet about a pin nudged onto the right doorway', () => {
    show({
      ...draftFromEvent(event),
      venue: { ...ACROSS_TOWN, latitude: 36.7542 },
    });

    expect(
      screen.getByText('No one will be notified of this edit.'),
      'the picker makes small adjustments easy, and a stray click must not message four people',
    ).toBeTruthy();
  });

  it('says nobody is affected when the host is the only one going', () => {
    show({ ...draftFromEvent(event), startsAt: LATER }, { goingCount: 1 });

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

  it('offers the map, so a café that actually moved can be moved too', () => {
    show();

    expect(screen.getByTestId('edit-venue')).toBeTruthy();
  });
});
