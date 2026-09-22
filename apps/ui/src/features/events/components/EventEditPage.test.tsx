import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EventDetailItem } from '@founders-coffee/server-fns';

const state = vi.hoisted(() => ({
  event: null as EventDetailItem | null,
}));

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ invalidate: vi.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),
}));

vi.mock('../hooks', () => ({
  useEventById: () => ({
    data: state.event,
    isPending: false,
    error: null,
    refetch: vi.fn(),
  }),
  useUpdateEvent: () => ({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
  }),
}));

vi.mock('./EventEditForm', async () => {
  const actual =
    await vi.importActual<typeof import('./EventEditForm')>('./EventEditForm');
  return {
    ...actual,
    EventEditForm: () => <form data-testid="edit-form" />,
  };
});

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
  citySlug: 'algiers',
} satisfies EventDetailItem;

const show = (event: EventDetailItem) => {
  state.event = event;
  return render(
    <EventEditPage
      locale="en"
      eventId={event.id}
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
    ).toBe('This meetup was cancelled and can no longer be edited.');
  });

  it('refuses one that has already happened', () => {
    show({
      ...base,
      startsAt: new Date('2020-01-01T10:00:00Z'),
      endsAt: new Date('2020-01-01T12:00:00Z'),
    });

    expect(screen.queryByTestId('edit-form')).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe(
      'This meetup has ended and can no longer be edited.',
    );
  });
});
