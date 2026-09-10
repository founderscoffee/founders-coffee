import type { Map as MapboxMap } from 'mapbox-gl';
import { useRef, useState, type RefObject } from 'react';

import { calloutFitsAbove, calloutFitsBelow } from './callout-placement';

type Point = { longitude: number; latitude: number } | null;

export interface CalloutPlacement {
  readonly above: boolean;
  readonly measure: (node: HTMLDivElement | null) => void;
  readonly sync: () => void;
}

/**
 * Whether the venue card hangs below the pin or flips above it, kept current as the map moves.
 *
 * The card lives inside a Mapbox marker, and a marker is not in the document until Mapbox adds it
 * to the map — so reading its height from the ref callback gives zero. A ResizeObserver measures it
 * once it is really laid out, and again whenever its text rewraps into a different number of lines.
 */
export const useCalloutPlacement = (
  mapRef: RefObject<MapboxMap | null>,
  point: Point,
): CalloutPlacement => {
  const [above, setAbove] = useState(false);
  const height = useRef(0);
  const observer = useRef<ResizeObserver | null>(null);
  const latest = useRef(point);
  latest.current = point;

  const sync = (): void => {
    const map = mapRef.current;
    const target = latest.current;
    if (!map || !target || height.current === 0) return;
    const { y } = map.project([target.longitude, target.latitude]);
    const fitsBelow = calloutFitsBelow(
      y,
      map.getContainer().clientHeight,
      height.current,
    );
    setAbove(!fitsBelow && calloutFitsAbove(y, height.current));
  };

  const measure = (node: HTMLDivElement | null): void => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) return;
    const resize = new ResizeObserver(() => {
      height.current = node.offsetHeight;
      sync();
    });
    resize.observe(node);
    observer.current = resize;
  };

  return { above, measure, sync };
};
