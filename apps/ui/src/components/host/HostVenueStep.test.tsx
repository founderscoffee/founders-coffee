import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@founders-coffee/core';

import { HostVenueStep } from './HostVenueStep';
import type { VenueError } from './useVenueNotices';

const idle = () => ({
  data: [] as unknown[],
  error: null as unknown,
  isPending: false,
  isError: false,
  isFetching: false,
  errorUpdatedAt: 0,
  refetch: vi.fn(),
});

const lookups = vi.hoisted(() => ({
  nearby: null as unknown as ReturnType<typeof idle>,
  search: null as unknown as ReturnType<typeof idle>,
}));

vi.mock('../../features/events/hooks', () => ({
  useNearbyVenues: () => lookups.nearby,
  useVenueSearch: () => lookups.search,
}));

const failed = (error: unknown, at = 1) => ({
  ...idle(),
  error,
  isError: true,
  errorUpdatedAt: at,
});

const step = (searchValue: string, venueError?: VenueError) => (
  <HostVenueStep
    locale="en"
    area={{ kind: 'city', name: 'Algiers' }}
    cityCode="556"
    marketCode="DZ"
    center={{ latitude: 36.75, longitude: 3.05 }}
    searchValue={searchValue}
    venue={null}
    venueName=""
    venueError={venueError}
    isDisabled={false}
    onSearchChange={vi.fn()}
    onVenueNameChange={vi.fn()}
    onVenueSelect={vi.fn()}
  />
);

const show = (searchValue = '', venueError?: VenueError) => {
  vi.useFakeTimers();
  const view = render(step(searchValue, venueError));
  act(() => vi.advanceTimersByTime(400));
  vi.useRealTimers();
  return view;
};

const toast = (text: string) =>
  screen.getByText(text).closest('[role="alert"]') as HTMLElement;

const hint = () =>
  document.querySelector('[aria-live="polite"]') as HTMLElement;

lookups.nearby = idle();
lookups.search = idle();

afterEach(() => {
  cleanup();
  lookups.nearby = idle();
  lookups.search = idle();
});

describe('the venue step when a lookup fails', () => {
  it('raises a failed search as a toast with a retry, not an alert in the column above the map', () => {
    lookups.search = failed(new Error('network'));
    show('café');

    const failure = toast('Could not search venues right now.');
    fireEvent.click(within(failure).getByRole('button', { name: 'Retry' }));

    expect(lookups.search.refetch).toHaveBeenCalledOnce();
  });

  it('says so when the search was refused for coming too often', () => {
    lookups.search = failed(new AppError('rate_limited', 'Too many'));
    show('café');

    expect(
      toast(
        'You have searched for venues too often. Wait a moment, then try again.',
      ),
    ).toBeTruthy();
  });

  it('keeps a failure up until the host puts it away, and shows the next one', () => {
    lookups.search = failed(new Error('network'), 1);
    const view = show('café');
    fireEvent.click(
      within(toast('Could not search venues right now.')).getByRole('button', {
        name: 'Dismiss notification',
      }),
    );

    expect(screen.queryByText('Could not search venues right now.')).toBeNull();

    lookups.search = failed(new Error('network'), 2);
    view.rerender(step('café'));

    expect(
      screen.getByText('Could not search venues right now.'),
      'putting one failure away silenced every later one',
    ).toBeTruthy();
  });

  it('steps aside while a retry is in flight', () => {
    lookups.search = { ...failed(new Error('network')), isFetching: true };
    show('café');

    expect(screen.queryByText('Could not search venues right now.')).toBeNull();
  });

  it('raises a failed nearby lookup the same way, and still points to the map', () => {
    lookups.nearby = failed(new Error('network'));
    show();

    fireEvent.click(
      within(toast('Could not search venues right now.')).getByRole('button', {
        name: 'Retry',
      }),
    );

    expect(lookups.nearby.refetch).toHaveBeenCalledOnce();
    expect(hint().textContent).toBe(
      'Choose a location on the map to get started.',
    );
  });

  it('reads the toast straight after the search box, where a keyboard reaches its retry', () => {
    lookups.search = failed(new Error('network'));
    show('café');

    const box = screen.getByRole('combobox');
    const failure = toast('Could not search venues right now.');

    expect(
      box.compareDocumentPosition(failure) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      failure.compareDocumentPosition(hint()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe('the venue step with nothing to list', () => {
  it('puts one short line where the list would be, not an alert', () => {
    show();

    expect(
      hint().textContent,
      'the line is announced as it changes, without the alert box that took the map’s room (#121)',
    ).toBe('Choose a location on the map to get started.');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      screen.queryByText('Cafés and coworking spaces nearby'),
      'a heading over an empty list took a line and said nothing',
    ).toBeNull();
  });

  it('says a search found nothing in the same place', () => {
    show('zzz');

    expect(hint().textContent).toBe('No cafés or coworking spaces found here.');
  });
});

describe('the venue step when the wizard refuses to go on', () => {
  it('raises the missing venue as a toast the wizard can clear', () => {
    const onDismiss = vi.fn();
    show('', { message: 'Choose a supported venue to continue.', onDismiss });

    fireEvent.click(
      within(toast('Choose a supported venue to continue.')).getByRole(
        'button',
        { name: 'Dismiss notification' },
      ),
    );

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
