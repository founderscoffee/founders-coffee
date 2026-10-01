import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { ComponentProps, ReactNode, Ref } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { VenueSelection } from '../../features/events/types';
import { HostMap } from './HostMap';

type ViewState = { latitude: number; longitude: number };

type MockMapProps = {
  ref?: Ref<object>;
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

const camera = vi.hoisted(() => ({ flyTo: vi.fn() }));

const reverse = vi.hoisted(() => ({ mutateAsync: vi.fn() }));

vi.mock('../../features/events/hooks', () => ({
  useReverseEventVenue: () => ({
    isPending: false,
    mutateAsync: reverse.mutateAsync,
  }),
}));

vi.mock('react-map-gl/mapbox', async () => {
  const { useImperativeHandle } = await import('react');
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
    Map: ({ ref, children, onClick, onMoveStart, onMoveEnd }: MockMapProps) => {
      useImperativeHandle(ref, () => ({
        flyTo: camera.flyTo,
        fitBounds: () => undefined,
        easeTo: () => undefined,
        resize: () => undefined,
        project: () => ({ x: 0, y: 0 }),
      }));
      return (
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
      );
    },
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

const ELSEWHERE: VenueSelection = {
  providerId: 'osm:node/2',
  kind: 'poi',
  name: 'Café Tantonville',
  address: 'Rue Didouche Mourad, Alger',
  latitude: 36.77,
  longitude: 3.06,
};

const STREET = {
  providerId: 'address-yousfi',
  kind: 'address' as const,
  name: '15 Rue Yousfi Mohamed',
  address: '15 Rue Yousfi Mohamed, Alger',
};

const map = (extra: Partial<ComponentProps<typeof HostMap>> = {}) => (
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
  />
);

const renderMap = (extra: Partial<ComponentProps<typeof HostMap>> = {}) =>
  render(map(extra));

const press = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }));

const flewTo = (venue: VenueSelection) =>
  expect.objectContaining({
    center: [venue.longitude, venue.latitude],
    zoom: 15,
  });

beforeEach(() => {
  reverse.mutateAsync.mockReturnValue(new Promise(() => undefined));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

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

describe('HostMap after a tap on the map', () => {
  it('flies to a place picked from the list after a tap that found nothing there', async () => {
    reverse.mutateAsync.mockRejectedValueOnce(new Error('unsupported'));
    const { rerender } = renderMap();
    fireEvent.click(screen.getByTestId('map-surface'));
    await screen.findByText('Could not load the venue map.');

    rerender(map({ venue: ELSEWHERE }));

    expect(
      camera.flyTo,
      'the failed tap was still counted as the host placing the next place, so a café picked from the list stayed off screen',
    ).toHaveBeenCalledWith(flewTo(ELSEWHERE));
  });

  it('leaves the camera where it is for the spot the host tapped', async () => {
    reverse.mutateAsync.mockResolvedValueOnce(STREET);
    const onVenueSelect = vi.fn();
    const { rerender } = renderMap({ onVenueSelect });
    fireEvent.click(screen.getByTestId('map-surface'));
    await waitFor(() => expect(onVenueSelect).toHaveBeenCalledOnce());

    rerender(map({ onVenueSelect, venue: onVenueSelect.mock.calls[0][0] }));

    expect(camera.flyTo).not.toHaveBeenCalled();
  });

  it('flies to a place picked while a tapped spot is still being looked up, and drops that lookup', async () => {
    let settle: (venue: typeof STREET) => void = () => undefined;
    reverse.mutateAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );
    const onVenueSelect = vi.fn();
    const { rerender } = renderMap({ onVenueSelect });
    fireEvent.click(screen.getByTestId('map-surface'));

    rerender(map({ onVenueSelect, venue: ELSEWHERE }));
    expect(camera.flyTo).toHaveBeenCalledWith(flewTo(ELSEWHERE));

    settle(STREET);
    await Promise.resolve();
    await Promise.resolve();
    expect(
      onVenueSelect,
      'the lookup finishing late put the tapped spot back over the place picked after it',
    ).not.toHaveBeenCalled();
  });
});
