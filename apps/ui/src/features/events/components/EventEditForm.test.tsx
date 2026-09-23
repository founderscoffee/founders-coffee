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
  cityNameFr: 'Alger',
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
  backLink?: React.ReactNode,
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
      backLink={backLink}
    />,
  );

const NOTICE = 'A change notification will be sent to all attendees.';

const notice = (): string =>
  document.querySelector('p[aria-live="polite"]')?.textContent ?? 'no region';

afterEach(() => cleanup());

describe('what the host is told a save will do', () => {
  it('says nothing at all while nothing that matters has changed', () => {
    show();

    expect(
      notice(),
      'a host fixing a typo is told nothing, because nothing is sent; a line promising silence is a sentence about an absence',
    ).toBe('');
  });

  it('warns as soon as the start moves', () => {
    show({ ...draftFromEvent(event), startsAt: LATER });

    expect(notice()).toBe(NOTICE);
  });

  it('warns when only the end moves, because that is still a change of plan', () => {
    show({
      ...draftFromEvent(event),
      endsAt: new Date('2099-09-20T14:00:00Z').getTime(),
    });

    expect(notice()).toBe(NOTICE);
  });

  it('warns when the cafe moves, even though the hour is untouched', () => {
    show({ ...draftFromEvent(event), venue: ACROSS_TOWN });

    expect(
      notice(),
      'somebody walking to the old address has to be told, so the warning cannot be reserved for the clock',
    ).toBe(NOTICE);
  });

  it('warns once, not twice, when the hour and the cafe both move', () => {
    show({ ...draftFromEvent(event), venue: ACROSS_TOWN, startsAt: LATER });

    expect(notice()).toBe(NOTICE);
  });

  it('stays quiet about a pin nudged onto the right doorway', () => {
    show({
      ...draftFromEvent(event),
      venue: { ...ACROSS_TOWN, latitude: 36.7542 },
    });

    expect(
      notice(),
      'the picker makes small adjustments easy, and a stray click must not promise four people a message',
    ).toBe('');
  });

  it('stays quiet when the host is the only one going', () => {
    show({ ...draftFromEvent(event), startsAt: LATER }, { goingCount: 1 });

    expect(
      notice(),
      'there is nobody to notify, so promising a notification would be untrue',
    ).toBe('');
  });

  it('keeps the live region in place while it has nothing to say', () => {
    show();

    expect(
      notice(),
      'a region that is removed and recreated announces nothing when the warning finally appears',
    ).not.toBe('no region');
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

describe('the two things a host can do from the bottom of the form', () => {
  it('sits the way out beside the way to save, in one row', () => {
    show(draftFromEvent(event), {}, <a href="/back">Back to the meetup</a>);

    const save = screen.getByRole('button', { name: 'Save changes' });
    const back = screen.getByRole('link', { name: 'Back to the meetup' });

    expect(
      save.parentElement,
      'leaving the form to find the way back below it reads as a footnote rather than a choice',
    ).toBe(back.parentElement);
  });
});

describe('correcting the language a meetup was filed under', () => {
  it('starts on the language the meetup is already filed under', () => {
    show();

    expect(
      (screen.getByLabelText(/^Language/) as unknown as HTMLSelectElement)
        .value,
    ).toBe('en');
  });

  it('offers every language the site speaks', () => {
    show();

    expect(
      [
        ...(screen.getByLabelText(/^Language/) as unknown as HTMLSelectElement)
          .options,
      ].map((option) => option.value),
    ).toEqual(['ar', 'en', 'fr']);
  });

  it('shows the correction the host is part way through making', () => {
    show({ ...draftFromEvent(event), language: 'ar' });

    expect(
      (screen.getByLabelText(/^Language/) as unknown as HTMLSelectElement)
        .value,
      'a host who picked Arabic and then moved the pin should not find English again',
    ).toBe('ar');
  });

  it('tells nobody, because what language it is in was always what it is in', () => {
    show({ ...draftFromEvent(event), language: 'ar' });

    expect(
      notice(),
      'the meetup did not move and did not change its hour; correcting how it is filed is not news an attendee has to act on',
    ).toBe('');
  });
});
