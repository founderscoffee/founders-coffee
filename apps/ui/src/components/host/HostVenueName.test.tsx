import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  getHostCreateMocks,
  renderHostCreateWizard,
  resetHostCreateFixtures,
} from './HostCreatePage.fixtures';

const hostCreateMocks = getHostCreateMocks();

const chooseAddress = async () =>
  fireEvent.click(
    await screen.findByRole('button', { name: 'Choose address' }),
  );

const chooseVenue = async () =>
  fireEvent.click(await screen.findByRole('button', { name: 'Choose venue' }));

describe('venue naming when only an address is verified', () => {
  afterEach(resetHostCreateFixtures);

  it('asks the host to name the place, and does not prefill the street', async () => {
    renderHostCreateWizard();
    await chooseAddress();

    const field = screen.getByLabelText(
      /^What is this place called\?/,
    ) as unknown as HTMLInputElement;
    expect(field.value).toBe('');
    expect(
      screen.getByText(/We could only confirm the street address here/),
    ).toBeTruthy();
  });

  it('never asks when the provider verified a real venue', async () => {
    renderHostCreateWizard();
    await chooseVenue();

    expect(screen.queryByLabelText(/^What is this place called\?/)).toBeNull();
  });

  it('collapses the nearby list so the name field follows the pin, and offers a way back', async () => {
    hostCreateMocks.nearbyVenues = [
      {
        providerId: 'osm-hamou',
        kind: 'poi' as const,
        name: 'Hamou',
        address: 'Medea',
        latitude: 36.26,
        longitude: 2.75,
        eligible: true,
      },
    ];
    renderHostCreateWizard();
    await chooseAddress();

    expect(screen.queryByText('Hamou')).toBeNull();
    expect(screen.getByLabelText(/^What is this place called\?/)).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', { name: 'Browse nearby venues' }),
    );

    expect(screen.getByText('Hamou')).toBeTruthy();
  });

  it('refuses to advance until the place is named, and says so', async () => {
    renderHostCreateWizard();
    await chooseAddress();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(
      screen.getByText('Name the venue so attendees can find the door.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Set schedule' })).toBeNull();
  });

  it('advances once named, and publishes the host name with the verified address', async () => {
    renderHostCreateWizard();
    await chooseAddress();
    fireEvent.change(screen.getByLabelText(/^What is this place called\?/), {
      target: { value: 'Café des Délices' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set schedule' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText(/^Title/), {
      target: { value: 'Protected meetup' },
    });
    fireEvent.change(screen.getByLabelText(/^Description/), {
      target: { value: 'A complete protected meetup for founders.' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm and publish' }),
    );

    expect(hostCreateMocks.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event: expect.objectContaining({
            venueName: 'Café des Délices',
            venueAddress: '15 Rue Yousfi Mohamed, Alger',
            latitude: 36.7501,
            longitude: 3.0601,
          }),
        }),
      }),
    );
  });
});
