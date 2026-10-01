import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { VenueSelection } from '../../features/events/types';
import { HostMap } from './HostMap';

type ViewState = { latitude: number; longitude: number };

type MockMapProps = {
  children?: ReactNode;
  onClick?: (event: { lngLat: { lat: number; lng: number } }) => void;
  onMoveStart?: (event: {
    originalEvent?: Event;
    viewState: ViewState;
  }) => void;
  onMoveEnd?: (event: { viewState: ViewState }) => void;
};

type MockMarkerProps = {
  children?: ReactNode;
  onDragEnd?: (event: { lngLat: { lat: number; lng: number } }) => void;
};

vi.mock('../../features/events/hooks', () => ({
  useReverseEventVenue: () => ({
    isPending: false,
    mutateAsync: () => new Promise(() => undefined),
  }),
}));

vi.mock('react-map-gl/mapbox', () => {
  const at = { latitude: 36.7538, longitude: 3.0588 };
  const control = (label: string, run: () => void) => (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        run();
      }}
    >
      {label}
    </button>
  );
  return {
    Map: ({ children, onClick, onMoveStart, onMoveEnd }: MockMapProps) => (
      <div
        data-testid="map-surface"
        onClick={() =>
          onClick?.({ lngLat: { lat: at.latitude, lng: at.longitude } })
        }
      >
        {control('host drags', () =>
          onMoveStart?.({
            originalEvent: new Event('pointerdown'),
            viewState: at,
          }),
        )}
        {control('map flies', () => onMoveStart?.({ viewState: at }))}
        {control('move ends', () => onMoveEnd?.({ viewState: at }))}
        {children}
      </div>
    ),
    Marker: ({ children, onDragEnd }: MockMarkerProps) => (
      <div
        data-testid="map-marker"
        onClick={(event) => {
          event.stopPropagation();
          onDragEnd?.({ lngLat: { lat: 36.76, lng: 3.07 } });
        }}
      >
        {children}
      </div>
    ),
  };
});

const CAFE: VenueSelection = {
  providerId: 'poi-cafe',
  kind: 'poi',
  name: 'Founders Café',
  address: '12 Startup Street, Algiers',
  latitude: 36.7538,
  longitude: 3.0588,
};

const renderMap = (extra: Partial<ComponentProps<typeof HostMap>> = {}) =>
  render(
    <HostMap
      accessToken="test-token"
      venue={null}
      viewport={{
        center: { latitude: 36.7538, longitude: 3.0588 },
        bounds: [2.9, 36.6, 3.3, 36.9],
      }}
      marketCode="DZ"
      locale="en"
      onVenueSelect={vi.fn()}
      onVenueInvalidate={vi.fn()}
      {...extra}
    />,
  );

const press = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }));

afterEach(cleanup);

describe('HostMap telling the page the host let go of it', () => {
  it('reports the end of a move the host made, once, and of no move the map made itself', () => {
    const onUserMove = vi.fn();
    const onUserGestureEnd = vi.fn();
    const onCenterChange = vi.fn();
    renderMap({ onUserMove, onUserGestureEnd, onCenterChange });

    press('map flies');
    press('move ends');
    expect(
      onUserGestureEnd,
      'flying to a café picked from the list is the map moving, not the host letting go of it',
    ).not.toHaveBeenCalled();

    press('host drags');
    expect(onUserMove).toHaveBeenCalledOnce();
    expect(
      onUserGestureEnd,
      'the drag is still under way: ending it now would change the page under the finger',
    ).not.toHaveBeenCalled();

    press('move ends');
    press('move ends');
    expect(onUserGestureEnd).toHaveBeenCalledOnce();
    expect(onCenterChange).toHaveBeenCalledTimes(3);
  });

  it('counts a tap that chooses a spot and a pin the host moved as letting go of the map', () => {
    const onUserGestureEnd = vi.fn();
    renderMap({ venue: CAFE, onUserGestureEnd });

    fireEvent.click(screen.getByTestId('map-surface'));
    expect(onUserGestureEnd).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByTestId('map-marker'));
    expect(onUserGestureEnd).toHaveBeenCalledTimes(2);
  });

  it('reports no tap or pin from a map the host cannot change', () => {
    const onUserGestureEnd = vi.fn();
    renderMap({ venue: CAFE, isInteractive: false, onUserGestureEnd });

    fireEvent.click(screen.getByTestId('map-surface'));
    fireEvent.click(screen.getByTestId('map-marker'));

    expect(onUserGestureEnd).not.toHaveBeenCalled();
  });
});
