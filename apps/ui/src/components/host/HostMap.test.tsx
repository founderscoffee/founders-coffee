import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { VenueSelection } from '../../features/events/types';
import { HostMap } from './HostMap';

type MockMapProps = {
  children?: ReactNode;
  onClick?: (event: { lngLat: { lat: number; lng: number } }) => void;
  onLoad?: () => void;
  mapLib?: unknown;
  workerUrl?: string;
};

type MockMarkerProps = {
  children?: ReactNode;
  onDragEnd?: (event: { lngLat: { lat: number; lng: number } }) => void;
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

vi.mock('react-map-gl/mapbox', () => ({
  Map: ({ children, onClick, onLoad, mapLib, workerUrl }: MockMapProps) => (
    <div
      data-testid="map-surface"
      data-worker-url={workerUrl}
      data-has-map-lib={String(mapLib !== undefined)}
      onClick={() => onClick?.({ lngLat: { lat: 36.7538, lng: 3.0588 } })}
    >
      <button
        type="button"
        data-testid="map-loaded"
        onClick={(event) => {
          event.stopPropagation();
          onLoad?.();
        }}
      />
      {children}
    </div>
  ),
  Marker: ({ children, onDragEnd }: MockMarkerProps) => (
    <div
      data-testid={onDragEnd ? 'map-marker' : 'map-callout'}
      onClick={(event) => {
        event.stopPropagation();
        onDragEnd?.({ lngLat: { lat: 36.76, lng: 3.07 } });
      }}
    >
      {children}
    </div>
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

const movedVenue: VenueSelection = {
  providerId: 'poi-coworking',
  kind: 'poi' as const,
  name: 'Founders Coworking',
  address: '18 Builder Street, Algiers',
  latitude: 36.76,
  longitude: 3.07,
};

const viewport = {
  center: { latitude: 36.7538, longitude: 3.0588 },
  bounds: [2.9, 36.6, 3.3, 36.9] as const,
};

const deferredVenue = () => {
  let settle: ((venue: VenueSelection) => void) | undefined;
  const promise = new Promise<VenueSelection>((resolve) => {
    settle = resolve;
  });
  return {
    promise,
    resolve: (venue: VenueSelection) => settle?.(venue),
  };
};

const renderMap = (
  venue: VenueSelection | null,
  onVenueSelect: (value: VenueSelection) => void,
  onVenueInvalidate: () => void,
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
    />,
  );

describe('HostMap', () => {
  beforeEach(() => {
    reverseVenueMocks.mutateAsync.mockResolvedValue(selectedVenue);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('normalizes map-click selection through the reverse-venue hook', async () => {
    const onVenueSelect = vi.fn();
    const onVenueInvalidate = vi.fn();
    renderMap(null, onVenueSelect, onVenueInvalidate);

    fireEvent.click(screen.getByTestId('map-surface'));

    expect(onVenueInvalidate).toHaveBeenCalledOnce();
    expect(reverseVenueMocks.mutateAsync).toHaveBeenCalledWith({
      marketCode: 'DZ',
      cityCode: '1',
      locale: 'en',
      latitude: 36.7538,
      longitude: 3.0588,
    });
    await waitFor(() =>
      expect(onVenueSelect).toHaveBeenCalledWith(
        expect.objectContaining({ providerId: selectedVenue.providerId }),
      ),
    );
  });

  it('invalidates stale venue data and resolves a dragged marker again', async () => {
    reverseVenueMocks.mutateAsync.mockResolvedValue(movedVenue);
    const onVenueSelect = vi.fn();
    const onVenueInvalidate = vi.fn();
    renderMap(selectedVenue, onVenueSelect, onVenueInvalidate);

    fireEvent.click(screen.getByTestId('map-marker'));

    expect(onVenueInvalidate).toHaveBeenCalledOnce();
    expect(reverseVenueMocks.mutateAsync).toHaveBeenCalledWith({
      marketCode: 'DZ',
      cityCode: '1',
      locale: 'en',
      latitude: 36.76,
      longitude: 3.07,
    });
    await waitFor(() => expect(onVenueSelect).toHaveBeenCalledWith(movedVenue));
  });

  it('ignores an older reverse lookup that finishes after a newer selection', async () => {
    const firstLookup = deferredVenue();
    const secondLookup = deferredVenue();
    reverseVenueMocks.mutateAsync
      .mockReturnValueOnce(firstLookup.promise)
      .mockReturnValueOnce(secondLookup.promise);
    const onVenueSelect = vi.fn();
    renderMap(null, onVenueSelect, vi.fn());

    fireEvent.click(screen.getByTestId('map-surface'));
    fireEvent.click(screen.getByTestId('map-surface'));
    secondLookup.resolve(movedVenue);
    await waitFor(() =>
      expect(onVenueSelect).toHaveBeenCalledWith(
        expect.objectContaining({ providerId: movedVenue.providerId }),
      ),
    );

    firstLookup.resolve(selectedVenue);
    await firstLookup.promise;
    await waitFor(() => expect(onVenueSelect).toHaveBeenCalledOnce());
  });

  it('anchors the venue callout to the pin instead of the map frame', () => {
    renderMap(selectedVenue, vi.fn(), vi.fn());

    const callout = screen.getByTestId('map-callout').textContent ?? '';
    expect(callout).toContain(selectedVenue.name);
    expect(callout).toContain(selectedVenue.address);
    expect(callout).toContain('Drag the pin to the exact door.');
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
});
