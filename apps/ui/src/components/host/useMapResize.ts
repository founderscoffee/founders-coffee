import type { Map as MapboxMap } from 'mapbox-gl';
import { useCallback, useRef, type RefObject } from 'react';

/**
 * A ref for the element that frames the map, which redraws the map at that element's size
 * whenever the size changes.
 *
 * Mapbox follows the window's size and nothing else. On a phone the name question for a street
 * address appears above the map and takes its height from the map's row, and the map went on
 * drawing at its old height: the part below the frame was cut off, with the pin in it.
 */
export const useMapResize = (mapRef: RefObject<MapboxMap | null>) => {
  const observer = useRef<ResizeObserver | null>(null);

  return useCallback(
    (node: HTMLElement | null) => {
      observer.current?.disconnect();
      observer.current = null;
      if (!node) return;
      const resize = new ResizeObserver(() => mapRef.current?.resize());
      resize.observe(node);
      observer.current = resize;
    },
    [mapRef],
  );
};
