import { act, cleanup, render, screen } from '@testing-library/react';
import { createElement, type ComponentProps } from 'react';
import { vi } from 'vitest';

import { HostVenueStep } from './HostVenueStep';
import type { VenueError } from './useVenueNotices';

/**
 * A lookup that has settled on nothing: no rows, no failure, nothing in flight.
 */
export const idle = () => ({
  data: [] as unknown[],
  error: null as unknown,
  isPending: false,
  isError: false,
  isFetching: false,
  errorUpdatedAt: 0,
  refetch: vi.fn(),
});

/**
 * A lookup that failed with `error`, stamped `at` so a second failure reads as a new one.
 */
export const failed = (error: unknown, at = 1) => ({
  ...idle(),
  error,
  isError: true,
  errorUpdatedAt: at,
});

const lookups = vi.hoisted(() => ({
  nearby: null as unknown as ReturnType<typeof idle>,
  search: null as unknown as ReturnType<typeof idle>,
}));

vi.mock('../../features/events/hooks', () => ({
  useNearbyVenues: () => lookups.nearby,
  useVenueSearch: () => lookups.search,
}));

lookups.nearby = idle();
lookups.search = idle();

/**
 * The nearby and search lookups the mocked hooks answer with, for a test to set before rendering.
 */
export const getVenueLookups = () => lookups;

type StepProps = Partial<ComponentProps<typeof HostVenueStep>>;

/**
 * The venue step as the wizard renders it for Algiers, with `searchValue` typed into it.
 */
export const venueStep = (
  searchValue: string,
  venueError?: VenueError,
  extra: StepProps = {},
) =>
  createElement(HostVenueStep, {
    locale: 'en',
    area: { kind: 'city', name: 'Algiers' },
    cityCode: '556',
    marketCode: 'DZ',
    center: { latitude: 36.75, longitude: 3.05 },
    searchValue,
    venue: null,
    venueName: '',
    venueError,
    isDisabled: false,
    onSearchChange: vi.fn(),
    onVenueNameChange: vi.fn(),
    onVenueSelect: vi.fn(),
    ...extra,
  });

/**
 * Render the venue step and let its search debounce run out, as a host who stopped typing.
 */
export const showVenueStep = (
  searchValue = '',
  venueError?: VenueError,
  extra: StepProps = {},
) => {
  vi.useFakeTimers();
  const view = render(venueStep(searchValue, venueError, extra));
  act(() => vi.advanceTimersByTime(400));
  vi.useRealTimers();
  return view;
};

/**
 * The toast carrying `text`.
 */
export const venueToast = (text: string) =>
  screen.getByText(text).closest('[role="alert"]') as HTMLElement;

/**
 * The one line the step announces where an empty list would be.
 */
export const venueHint = () =>
  document.querySelector('[aria-live="polite"]') as HTMLElement;

/**
 * Unmount the step and put every lookup back to settled and empty.
 */
export const resetVenueStep = () => {
  cleanup();
  lookups.nearby = idle();
  lookups.search = idle();
};
