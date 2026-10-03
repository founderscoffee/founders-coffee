import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@founders-coffee/core';

import { renderHostMap, reverse } from './HostMap.fixtures';

const NOTHING_HERE = 'Choose a café, restaurant, or coworking space';

const MAP_FAILED = 'Could not load the venue map.';

const tapRefusedWith = (error: AppError) => {
  reverse.mutateAsync.mockRejectedValueOnce(error);
  renderHostMap();
  fireEvent.click(screen.getByTestId('map-surface'));
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('A tap the host map cannot resolve', () => {
  it('asks for a café, restaurant or coworking space when the map has nothing at that point', async () => {
    tapRefusedWith(
      new AppError(
        'map_venue_not_found',
        'No address could be resolved near this point',
      ),
    );

    expect(await screen.findByText(NOTHING_HERE)).toBeTruthy();
    expect(screen.queryByText(MAP_FAILED)).toBeNull();
  });

  it('says the map failed when the provider does', async () => {
    tapRefusedWith(
      new AppError('map_provider_unavailable', 'Map provider request failed'),
    );

    expect(await screen.findByText(MAP_FAILED)).toBeTruthy();
    expect(screen.queryByText(NOTHING_HERE)).toBeNull();
  });
});
