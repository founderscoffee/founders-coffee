import type { Map as MapboxMap } from 'mapbox-gl';
import { useEffect, useRef, type RefObject } from 'react';

import type { HostMapViewport } from '../../features/events/types';

type Point = { longitude: number; latitude: number } | null;

const FIT_MARGIN = 24;
const PIN_HEIGHT = 52;

/**
 * Mapbox padding for a map whose top `covered` pixels are hidden, and `margin` more on every side.
 */
export const coverPadding = (covered: number, margin = 0) => ({
  top: covered + margin,
  bottom: margin,
  left: margin,
  right: margin,
});

/**
 * The camera a map opens on: close on the place already chosen at `zoom`, or else the whole of
 * `viewport`, each kept clear of the top `covered` pixels as the map's own later moves are.
 */
export const initialCamera = (
  pin: Point,
  viewport: HostMapViewport,
  covered: number,
  zoom: number,
) => {
  if (pin) {
    return {
      longitude: pin.longitude,
      latitude: pin.latitude,
      zoom,
      padding: coverPadding(covered),
    };
  }
  const [west, south, east, north] = viewport.bounds;
  return {
    bounds: [
      [west, south],
      [east, north],
    ] as [[number, number], [number, number]],
    fitBoundsOptions: { padding: coverPadding(covered, FIT_MARGIN) },
  };
};

/**
 * Keep the moves the map makes on its own clear of the panel floating over its top edge.
 *
 * Mapbox centres on the middle of the whole frame, so below `lg`, where the venue list covers the
 * top of the map, a city or a chosen café would land half under it. The map's own moves — a new
 * city's bounds, a venue picked from the list — are padded by the covered height, and a pin the
 * panel opens over is brought back into view. A move the host is making is never taken over: the
 * panel only grows when they are reading it, not while they drag. Returns the padding to use now.
 */
export const useMapCover = (
  mapRef: RefObject<MapboxMap | null>,
  covered: number,
  viewport: HostMapViewport,
  pin: Point,
) => {
  const latest = useRef(covered);
  latest.current = covered;
  const bounds = viewport.bounds.join(',');
  const fitted = useRef(bounds);

  useEffect(() => {
    if (fitted.current === bounds) return;
    fitted.current = bounds;
    const [west, south, east, north] = viewport.bounds;
    mapRef.current?.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: coverPadding(latest.current, FIT_MARGIN) },
    );
  }, [bounds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pin || covered === 0) return;
    const { y } = map.project([pin.longitude, pin.latitude]);
    if (y - PIN_HEIGHT >= covered) return;
    map.easeTo({
      center: [pin.longitude, pin.latitude],
      padding: coverPadding(covered),
    });
  }, [covered]);

  return (): ReturnType<typeof coverPadding> => coverPadding(latest.current);
};
