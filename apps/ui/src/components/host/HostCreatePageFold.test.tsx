import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getHostCreateMocks,
  renderHostCreateWizard,
  resetHostCreateFixtures,
} from './HostCreatePage.fixtures';

const NEARBY_CAFE = {
  providerId: 'osm-hamou',
  kind: 'poi' as const,
  name: 'Hamou',
  address: 'Alger',
  latitude: 36.75,
  longitude: 3.06,
  eligible: true,
};

vi.mock('./useCoveredHeight', () => {
  const refs = new Map<
    (height: number) => void,
    (node: HTMLElement | null) => void
  >();
  return {
    useCoveredHeight: (onCoverChange: (height: number) => void) => {
      if (!refs.has(onCoverChange)) {
        refs.set(onCoverChange, (node) => onCoverChange(node ? 238 : 0));
      }
      return refs.get(onCoverChange);
    },
  };
});

describe('the venue list folded over the map on a phone', () => {
  afterEach(resetHostCreateFixtures);

  it('folds once the host picks a place from it, leaving the map to show the pin', async () => {
    getHostCreateMocks().nearbyVenues = [NEARBY_CAFE];
    renderHostCreateWizard();
    const toggle = await screen.findByRole('button', { name: 'Places nearby' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(screen.getByRole('option'));

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('folds at a tap on the map, and stays open for a tap in the search box', async () => {
    getHostCreateMocks().nearbyVenues = [NEARBY_CAFE];
    renderHostCreateWizard();
    const toggle = await screen.findByRole('button', { name: 'Places nearby' });

    fireEvent.pointerDown(
      screen.getByLabelText('Search cafés and coworking venues'),
    );
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.pointerDown(screen.getByTestId('host-map'));
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('stays folded when the tap outside it chooses a spot on the map, which the callout names', async () => {
    getHostCreateMocks().nearbyVenues = [NEARBY_CAFE];
    renderHostCreateWizard();
    const toggle = await screen.findByRole('button', { name: 'Places nearby' });
    const spot = screen.getByRole('button', { name: 'Choose address' });

    fireEvent.pointerDown(spot);
    fireEvent.click(spot);

    expect(
      toggle.getAttribute('aria-expanded'),
      'every tap on the map chooses a spot, so reopening for it undid every tap outside',
    ).toBe('false');
  });

  it('unfolds when Next finds the chosen address unnamed, so the host sees why', async () => {
    renderHostCreateWizard();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Choose address' }),
    );
    const toggle = screen.getByRole('button', { name: 'Selected location' });
    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(
      toggle.getAttribute('aria-expanded'),
      'the missing name was reported inside a list folded out of sight',
    ).toBe('true');
    expect(
      screen.getByText('Name the venue so attendees can find the entrance.'),
    ).toBeTruthy();
  });
});
