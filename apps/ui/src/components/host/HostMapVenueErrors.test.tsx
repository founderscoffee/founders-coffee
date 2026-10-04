import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@founders-coffee/core';

import { renderHostMap, reverse } from './HostMap.fixtures';

const NOTHING_HERE = 'Choose a café, restaurant, or coworking space';

const MAP_FAILED = 'Could not load the venue map.';

const tapRefusedWith = (error: AppError) => {
  const onMiss = vi.fn();
  reverse.mutateAsync.mockRejectedValueOnce(error);
  renderHostMap({ onMiss });
  fireEvent.click(screen.getByTestId('map-surface'));
  return onMiss;
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('A tap the host map cannot resolve', () => {
  it('hands the host back to the page, not a message, when the map has nothing at that point', async () => {
    const onMiss = tapRefusedWith(
      new AppError(
        'map_venue_not_found',
        'No address could be resolved near this point',
      ),
    );

    await waitFor(() => expect(onMiss).toHaveBeenCalledOnce());
    expect(
      screen.queryByText(NOTHING_HERE),
      'a toast told the host what kind of place to pick, where the places to pick from were',
    ).toBeNull();
    expect(screen.queryByText(MAP_FAILED)).toBeNull();
  });

  it('says the map failed when the provider does', async () => {
    const onMiss = tapRefusedWith(
      new AppError('map_provider_unavailable', 'Map provider request failed'),
    );

    expect(await screen.findByText(MAP_FAILED)).toBeTruthy();
    expect(screen.queryByText(NOTHING_HERE)).toBeNull();
    expect(onMiss).not.toHaveBeenCalled();
  });
});
