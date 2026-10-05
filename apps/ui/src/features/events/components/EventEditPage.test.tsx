import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EventDetailItem } from '@founders-coffee/server-fns';

import type { EventEditDraft } from '../event-edit-draft';

type FormStandInProps = {
  draft: EventEditDraft;
  onDraftChange: (next: EventEditDraft) => void;
  onSubmit: () => void;
};

const state = vi.hoisted(() => ({
  event: null as EventDetailItem | null,
}));

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),
}));

vi.mock('../../geo/hooks', () => ({
  useCitySuggestions: () => ({ data: [] }),
}));
vi.mock('../hooks', () => ({
  useEventById: () => ({
    data: state.event,
    isPending: false,
    error: null,
    refetch: vi.fn(),
  }),
  useUpdateEvent: () => ({
    mutate: (_input: unknown, settle: { onSuccess: () => void }) =>
      settle.onSuccess(),
    isPending: false,
    isSuccess: false,
  }),
}));

vi.mock('./EventEditForm', () => ({
  EventEditForm: ({ draft, onDraftChange, onSubmit }: FormStandInProps) => (
    <form
      data-testid="edit-form"
      onSubmit={(submitted) => {
        submitted.preventDefault();
        onSubmit();
      }}
    >
      <input
        aria-label="Title"
        value={draft.title}
        onChange={(changed) =>
          onDraftChange({ ...draft, title: changed.target.value })
        }
      />
      <button type="submit">Save</button>
    </form>
  ),
}));

const { EventEditPage } = await import('./EventEditPage');

const base = {
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
  rsvps: 2,
  language: 'en',
  languages: ['en'],
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
  goingCount: 2,
  viewerRsvp: 'going',
  cityName: 'Algiers',
  cityNameAr: 'الجزائر',
  cityNameFr: 'Alger',
  citySlug: 'algiers',
  stateName: 'Alger',
  stateNameAr: 'الجزائر',
  stateNameFr: 'Alger',
} satisfies EventDetailItem;

const show = (event: EventDetailItem) => {
  state.event = event;
  return render(
    <EventEditPage
      locale="en"
      eventId={event.id}
      mapboxToken="pk.test"
      markets={[{ code: 'DZ', slug: 'algeria', timezone: 'Africa/Algiers' }]}
    />,
  );
};

afterEach(() => {
  cleanup();
  state.event = null;
});

describe('a meetup that can no longer be changed', () => {
  it('offers the form for one that is still ahead', () => {
    show(base);

    expect(screen.getByTestId('edit-form')).toBeTruthy();
  });

  it('refuses a cancelled meetup before the host fills anything in', () => {
    show({ ...base, status: 'cancelled', cancelledAt: new Date() });

    expect(screen.queryByTestId('edit-form')).toBeNull();
    expect(
      screen.getByRole('alert').textContent,
      'letting a host retype a whole form only to refuse it on save is the defect #73 already records elsewhere',
    ).toBe('The meetup was cancelled and cannot be edited.');
  });

  it('refuses one that has already happened', () => {
    show({
      ...base,
      startsAt: new Date('2020-01-01T10:00:00Z'),
      endsAt: new Date('2020-01-01T12:00:00Z'),
    });

    expect(screen.queryByTestId('edit-form')).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe(
      'The meetup has ended and cannot be edited.',
    );
  });
});

const retitled = 'Founders breakfast, second edition';

const retitle = () =>
  fireEvent.change(screen.getByRole('textbox', { name: 'Title' }), {
    target: { value: retitled },
  });

const titleShown = () =>
  screen.getByRole<HTMLInputElement>('textbox', { name: 'Title' }).value;

describe('changes a host has not saved', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('come back when the page loads again', () => {
    show(base);
    retitle();
    cleanup();

    show(base);

    expect(
      titleShown(),
      'a reload took everything the host had changed in the form',
    ).toBe(retitled);
  });

  it('are gone once saved', () => {
    show(base);
    retitle();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    cleanup();

    show(base);

    expect(titleShown()).toBe(base.title);
  });

  it('are dropped once the meetup has changed since', () => {
    show(base);
    retitle();
    cleanup();

    show({ ...base, version: 2, title: 'Founders brunch' });

    expect(titleShown()).toBe('Founders brunch');
  });

  it('stay with the meetup they were made on', () => {
    show(base);
    retitle();
    cleanup();

    show({ ...base, id: 'evt_2' });

    expect(titleShown()).toBe(base.title);
  });
});
