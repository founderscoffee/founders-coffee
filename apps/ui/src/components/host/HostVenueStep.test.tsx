import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@founders-coffee/core';

import {
  failed,
  getVenueLookups,
  resetVenueStep,
  showVenueStep,
  venueHint,
  venueStep,
  venueToast,
} from './HostVenueStep.fixtures';

afterEach(resetVenueStep);

const lookups = getVenueLookups();

describe('the venue step when a lookup fails', () => {
  it('raises a failed search as a toast with a retry, not an alert in the column above the map', () => {
    lookups.search = failed(new Error('network'));
    showVenueStep('café');

    const failure = venueToast('Could not search venues right now.');
    fireEvent.click(within(failure).getByRole('button', { name: 'Retry' }));

    expect(lookups.search.refetch).toHaveBeenCalledOnce();
  });

  it('says so when the search was refused for coming too often', () => {
    lookups.search = failed(new AppError('rate_limited', 'Too many'));
    showVenueStep('café');

    expect(
      venueToast(
        'You have searched for venues too often. Wait a moment, then try again.',
      ),
    ).toBeTruthy();
  });

  it('keeps a failure up until the host puts it away, and shows the next one', () => {
    lookups.search = failed(new Error('network'), 1);
    const view = showVenueStep('café');
    fireEvent.click(
      within(venueToast('Could not search venues right now.')).getByRole(
        'button',
        {
          name: 'Dismiss notification',
        },
      ),
    );

    expect(screen.queryByText('Could not search venues right now.')).toBeNull();

    lookups.search = failed(new Error('network'), 2);
    view.rerender(venueStep('café'));

    expect(
      screen.getByText('Could not search venues right now.'),
      'putting one failure away silenced every later one',
    ).toBeTruthy();
  });

  it('steps aside while a retry is in flight', () => {
    lookups.search = { ...failed(new Error('network')), isFetching: true };
    showVenueStep('café');

    expect(screen.queryByText('Could not search venues right now.')).toBeNull();
  });

  it('raises a failed nearby lookup the same way, and still points to the map', () => {
    lookups.nearby = failed(new Error('network'));
    showVenueStep();

    fireEvent.click(
      within(venueToast('Could not search venues right now.')).getByRole(
        'button',
        {
          name: 'Retry',
        },
      ),
    );

    expect(lookups.nearby.refetch).toHaveBeenCalledOnce();
    expect(venueHint().textContent).toBe(
      'Choose a location on the map to get started.',
    );
  });

  it('reads the toast straight after the search box, where a keyboard reaches its retry', () => {
    lookups.search = failed(new Error('network'));
    showVenueStep('café');

    const box = screen.getByRole('combobox');
    const failure = venueToast('Could not search venues right now.');

    expect(
      box.compareDocumentPosition(failure) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      failure.compareDocumentPosition(venueHint()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe('the venue step with nothing to list', () => {
  it('puts one short line where the list would be, not an alert', () => {
    showVenueStep();

    expect(
      venueHint().textContent,
      'the line is announced as it changes, without the alert box that took the map’s room (#121)',
    ).toBe('Choose a location on the map to get started.');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      screen.queryByText('Cafés and coworking spaces nearby'),
      'a heading over an empty list took a line and said nothing',
    ).toBeNull();
  });

  it('says a search found nothing in the same place', () => {
    showVenueStep('zzz');

    expect(venueHint().textContent).toBe(
      'No cafés or coworking spaces found here.',
    );
  });
});

describe('the venue step when the wizard refuses to go on', () => {
  it('raises the missing venue as a toast the wizard can clear', () => {
    const onDismiss = vi.fn();
    showVenueStep('', {
      message: 'Choose a supported venue to continue.',
      onDismiss,
    });

    fireEvent.click(
      within(venueToast('Choose a supported venue to continue.')).getByRole(
        'button',
        { name: 'Dismiss notification' },
      ),
    );

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
