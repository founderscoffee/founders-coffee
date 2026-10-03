import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  createElement,
  type ComponentProps,
  type ReactNode,
  type Ref,
} from 'react';
import { expect, vi } from 'vitest';

import type { VenueSelection } from '../../features/events/types';
import { HostMap } from './HostMap';

type ViewState = { latitude: number; longitude: number };

type LngLat = { lngLat: { lat: number; lng: number } };

type Tap = LngLat & { target: { getZoom: () => number } };

type MapStandInProps = {
  ref?: Ref<object>;
  children?: ReactNode;
  onClick?: (event: Tap) => void;
  onMoveStart?: (event: {
    originalEvent?: Event;
    viewState: ViewState;
  }) => void;
  onMoveEnd?: (event: { viewState: ViewState }) => void;
};

type MarkerStandInProps = {
  children?: ReactNode;
  longitude: number;
  latitude: number;
  onDragEnd?: (event: LngLat) => void;
};

type Click = { stopPropagation: () => void };

const camera = vi.hoisted(() => ({ flyTo: vi.fn(), zoom: 16 }));

const reverse = vi.hoisted(() => ({ mutateAsync: vi.fn() }));

const suggestions = vi.hoisted(() => ({
  cities: [] as unknown[],
  asked: [] as { marketCode: string; query: string }[],
}));

vi.mock('../../features/events/hooks', () => ({
  useReverseEventVenue: () => ({
    isPending: false,
    mutateAsync: reverse.mutateAsync,
  }),
}));

vi.mock('../../features/geo/hooks', () => ({
  useCitySuggestions: (marketCode: string, query: string) => {
    suggestions.asked.push({ marketCode, query });
    return { data: query.length >= 2 ? suggestions.cities : undefined };
  },
  useDebouncedValue: <T>(value: T) => value,
}));

vi.mock('react-map-gl/mapbox', async () => {
  const { createElement: draw, useImperativeHandle } = await import('react');
  const at = { latitude: 36.7538, longitude: 3.0588 };
  const control = (label: string, run: () => void) =>
    draw(
      'button',
      {
        type: 'button',
        onClick: (event: Click) => {
          event.stopPropagation();
          run();
        },
      },
      label,
    );
  return {
    Map: ({
      ref,
      children,
      onClick,
      onMoveStart,
      onMoveEnd,
    }: MapStandInProps) => {
      useImperativeHandle(ref, () => ({
        flyTo: camera.flyTo,
        fitBounds: () => undefined,
        easeTo: () => undefined,
        resize: () => undefined,
        project: () => ({ x: 0, y: 0 }),
      }));
      return draw(
        'div',
        {
          'data-testid': 'map-surface',
          onClick: () =>
            onClick?.({
              lngLat: { lat: at.latitude, lng: at.longitude },
              target: { getZoom: () => camera.zoom },
            }),
        },
        control('host drags', () =>
          onMoveStart?.({
            originalEvent: new Event('pointerdown'),
            viewState: at,
          }),
        ),
        control('map flies', () => onMoveStart?.({ viewState: at })),
        control('move ends', () => onMoveEnd?.({ viewState: at })),
        children,
      );
    },
    Marker: ({
      children,
      longitude,
      latitude,
      onDragEnd,
    }: MarkerStandInProps) =>
      draw(
        'div',
        {
          'data-testid': 'map-marker',
          'data-at': `${latitude},${longitude}`,
          onClick: (event: Click) => {
            event.stopPropagation();
            onDragEnd?.({ lngLat: { lat: 36.76, lng: 3.07 } });
          },
        },
        children,
      ),
  };
});

export const CAFE: VenueSelection = {
  providerId: 'poi-cafe',
  kind: 'poi',
  name: 'Founders Café',
  address: '12 Startup Street, Algiers',
  latitude: 36.7538,
  longitude: 3.0588,
};

export const ELSEWHERE: VenueSelection = {
  providerId: 'osm:node/2',
  kind: 'poi',
  name: 'Café Tantonville',
  address: 'Rue Didouche Mourad, Alger',
  latitude: 36.77,
  longitude: 3.06,
};

export const STREET = {
  providerId: 'address-yousfi',
  kind: 'address' as const,
  name: '15 Rue Yousfi Mohamed',
  address: '15 Rue Yousfi Mohamed, Alger',
};

type HostMapProps = ComponentProps<typeof HostMap>;

/** The host map over a stand-in Mapbox, with whatever props a test overrides. */
export const hostMap = (extra: Partial<HostMapProps> = {}) =>
  createElement(HostMap, {
    accessToken: 'test-token',
    venue: null,
    viewport: {
      center: { latitude: 36.7538, longitude: 3.0588 },
      bounds: [2.9, 36.6, 3.3, 36.9],
    },
    marketCode: 'DZ',
    locale: 'en',
    onVenueSelect: vi.fn(),
    onVenueInvalidate: vi.fn(),
    ...extra,
  });

/** Render the host map over a stand-in Mapbox. */
export const renderHostMap = (extra: Partial<HostMapProps> = {}) =>
  render(hostMap(extra));

/** Press the button named `name`. */
export const press = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }));

/** A camera flight to `point` at `zoom`, as the map's `flyTo` receives it. */
export const flewTo = (
  point: { latitude: number; longitude: number },
  zoom: number,
) =>
  expect.objectContaining({
    center: [point.longitude, point.latitude],
    zoom,
  });

type BrowserAnswer = {
  found: (coords: { latitude: number; longitude: number }) => void;
  refused: () => void;
};

/**
 * Stand in for the browser's geolocation, and hand back the answers a test gives it once asked.
 */
export const browserAsked = () => {
  const answer: BrowserAnswer = {
    found: () => undefined,
    refused: () => undefined,
  };
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (
        success: PositionCallback,
        failure: PositionErrorCallback,
      ) => {
        answer.found = (coords) =>
          success({ coords } as unknown as GeolocationPosition);
        answer.refused = () =>
          failure({ code: 1 } as unknown as GeolocationPositionError);
      },
    },
  });
  return answer;
};

/** Give the browser's `answer` and let the map act on it. */
export const settle = (answer: () => void) =>
  act(async () => {
    answer();
  });

export { camera, reverse, suggestions };
