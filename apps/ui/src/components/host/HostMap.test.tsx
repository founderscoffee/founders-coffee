import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { VenueSelection } from '../../features/events/types';
import { HostMap } from './HostMap';

type MockMapProps = {
  children?: ReactNode;
  onLoad?: () => void;
  onMoveStart?: (event: { originalEvent?: Event }) => void;
  mapLib?: unknown;
  workerUrl?: string;
};

type MockMarkerProps = {
  children?: ReactNode;
};

const reverseVenueMocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
}));

vi.mock('../../features/events/hooks', () => ({
  useReverseEventVenue: () => ({
    isPending: false,
    mutateAsync: reverseVenueMocks.mutateAsync,
  }),
}));

vi.mock('../../features/geo/hooks', () => ({
  useCitySuggestions: () => ({ data: undefined }),
  useDebouncedValue: <T,>(value: T) => value,
}));

vi.mock('react-map-gl/mapbox', () => ({
  Map: ({ children, onLoad, onMoveStart, mapLib, workerUrl }: MockMapProps) => (
    <div
      data-testid="map-surface"
      data-worker-url={workerUrl}
      data-has-map-lib={String(mapLib !== undefined)}
    >
      <button
        type="button"
        data-testid="map-loaded"
        onClick={(event) => {
          event.stopPropagation();
          onLoad?.();
        }}
      />
      <button
        type="button"
        data-testid="map-camera-move"
        onClick={(event) => {
          event.stopPropagation();
          onMoveStart?.({});
        }}
      />
      <button
        type="button"
        data-testid="map-host-drag"
        onClick={(event) => {
          event.stopPropagation();
          onMoveStart?.({ originalEvent: new Event('pointerdown') });
        }}
      />
      {children}
    </div>
  ),
  Marker: ({ children }: MockMarkerProps) => (
    <div data-testid="map-marker">{children}</div>
  ),
}));

const selectedVenue: VenueSelection = {
  providerId: 'poi-cafe',
  kind: 'poi' as const,
  name: 'Founders Café',
  address: '12 Startup Street, Algiers',
  latitude: 36.7538,
  longitude: 3.0588,
};

const viewport = {
  center: { latitude: 36.7538, longitude: 3.0588 },
  bounds: [2.9, 36.6, 3.3, 36.9] as const,
};

const renderMap = (
  venue: VenueSelection | null,
  onVenueSelect: (value: VenueSelection) => void,
  onVenueInvalidate: () => void,
  extra: Partial<ComponentProps<typeof HostMap>> = {},
) =>
  render(
    <HostMap
      accessToken="test-token"
      venue={venue}
      viewport={viewport}
      cityCode="1"
      marketCode="DZ"
      locale="en"
      onVenueSelect={onVenueSelect}
      onVenueInvalidate={onVenueInvalidate}
      {...extra}
    />,
  );

describe('HostMap', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('marks a chosen place with the pin alone, with no card over the map', () => {
    renderMap(selectedVenue, vi.fn(), vi.fn());

    expect(screen.getAllByTestId('map-marker')).toHaveLength(1);
    const map = screen.getByTestId('map-surface').textContent ?? '';
    expect(map).not.toContain(selectedVenue.name);
    expect(map).not.toContain(selectedVenue.address);
  });

  it('covers the map with a skeleton until Mapbox reports it is loaded', () => {
    renderMap(null, vi.fn(), vi.fn());

    const mapLoading = () =>
      screen
        .queryAllByRole('status')
        .find((region) => region.textContent === 'Loading the venue map…');

    expect(mapLoading()).toBeDefined();

    fireEvent.click(screen.getByTestId('map-loaded'));

    expect(mapLoading()).toBeUndefined();
  });

  it('hands Mapbox a self-hosted worker and the object it can write globals onto', () => {
    renderMap(null, vi.fn(), vi.fn());
    const surface = screen.getByTestId('map-surface');

    expect(surface.getAttribute('data-worker-url')).toMatch(/^[^:]*\/[^:]*$/);
    expect(surface.getAttribute('data-worker-url')).toContain(
      'mapbox-gl-csp-worker',
    );
    expect(surface.getAttribute('data-has-map-lib')).toBe('true');
  });

  it('requests precise location only after the visitor activates Locate me', () => {
    const getCurrentPosition = vi.fn();
    vi.stubGlobal('navigator', {
      geolocation: { getCurrentPosition },
    });
    renderMap(null, vi.fn(), vi.fn());

    expect(getCurrentPosition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Locate me' }));
    expect(getCurrentPosition).toHaveBeenCalledOnce();
  });

  it('reports only the moves the host makes, so the list folds for them alone', () => {
    const onUserMove = vi.fn();
    renderMap(null, vi.fn(), vi.fn(), { onUserMove });

    fireEvent.click(screen.getByTestId('map-camera-move'));
    expect(
      onUserMove,
      'flying to a café the host picked from the list is the map moving, not the host taking hold of it',
    ).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('map-host-drag'));
    expect(onUserMove).toHaveBeenCalledOnce();
  });

  it('passes on the size of Locate me, for the list that shares its row', () => {
    const onLocateResize = vi.fn();
    renderMap(null, vi.fn(), vi.fn(), { onLocateResize });

    const locate = screen.getByRole('button', { name: 'Locate me' });
    expect(onLocateResize).toHaveBeenCalledWith({
      width: locate.offsetWidth,
      height: locate.offsetHeight,
    });
  });
});
